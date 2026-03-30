const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const { execFile } = require('child_process');
app.commandLine.appendSwitch('ignore-certificate-errors');
const path = require('path');
const http = require('http');
const io = require('socket.io-client');
const InputManager = require('./input-manager');

// Configuration
const SERVER_URL = 'https://connect-pupt.onrender.com';
let socket;
let mainWindow;
let captureInterval;
let isControlled = false;
const AGENT_ID = 'AGENT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
const LOCAL_PORT = 5701;

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Move app.whenReady() or other logic here if you want it inside the lock
    // But usually you just quit if it's not the first instance.
}

// Performance Optimization: Throttling
let lastMouseMove = 0;
const MOUSE_THROTTLE_MS = 33; // ~30 FPS for mouse events

// Session Linking
global.meetingId = null;
global.participantId = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 550,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: true
    });

    mainWindow.loadFile('index.html');

    // Send initial ID and status
    mainWindow.webContents.on('did-finish-load', () => {
        const currentStatus = (socket && socket.connected) ? 'Connected' : 'Connecting...';
        mainWindow.webContents.send('status-update', {
            status: currentStatus,
            agentId: AGENT_ID,
            serverUrl: SERVER_URL,
            meetingId: global.meetingId
        });
    });
}



let captureTimeout;

async function captureLoop(hostId) {
    if (!isControlled) return;
    try {
        const start = Date.now();
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1280, height: 720 }
        });

        if (sources.length > 0) {
            const screenSource = sources[0];
            const thumb = screenSource.thumbnail;
            if (!thumb.isEmpty()) {
                const jpegBuffer = thumb.toJPEG(60);
                const base64 = jpegBuffer.toString('base64');

                socket.emit('agent_frame', {
                    hostId,
                    frame: `data:image/jpeg;base64,${base64}`
                });
            }
        }

        // Dynamically delay to prevent event loop starvation (~15 FPS target)
        const elapsed = Date.now() - start;
        const delay = Math.max(0, 66 - elapsed);

        if (isControlled) {
            captureTimeout = setTimeout(() => captureLoop(hostId), delay);
        }
    } catch (err) {
        console.error('Capture error:', err);
        // Continue loop even on failure to avoid deadlocks
        if (isControlled) {
            captureTimeout = setTimeout(() => captureLoop(hostId), 100);
        }
    }
}

async function startStreaming(hostId) {
    if (captureTimeout) clearTimeout(captureTimeout);
    isControlled = true;
    console.log('Starting screen stream for host:', hostId);
    captureLoop(hostId);
}

function stopStreaming() {
    if (captureTimeout) clearTimeout(captureTimeout);
    isControlled = false;
}

async function handleInputEvent(event) {
    if (!isControlled) return;

    try {
        const { type, x, y, button, key } = event;
        const { width, height } = screen.getPrimaryDisplay().bounds;

        if (type === 'mouse_move') {
            const now = Date.now();
            if (now - lastMouseMove > MOUSE_THROTTLE_MS) {
                await InputManager.moveMouse(x * width, y * height);
                lastMouseMove = now;
            }
        } else if (type === 'mouse_click') {
            await InputManager.clickMouse(button || 'left', event.double || false);
        } else if (type === 'key_down' || type === 'key_press' || type === 'key_up') {
            await InputManager.typeKey(key);
        }
    } catch (err) {
        console.error('Input execution error:', err);
    }
}

function startLocalServer() {
    const server = http.createServer((req, res) => {
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.url === '/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'running',
                agentId: AGENT_ID,
                linked: !!(global.meetingId && global.participantId)
            }));
        } else if (req.url === '/link' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    global.meetingId = data.meetingId;
                    global.participantId = data.participantId;

                    console.log('Linked to session:', data);

                    // NEW: Socket-based status detection (Robust fix)
                    if (socket && socket.connected) {
                        console.log("agent_status sent", global.participantId);
                        socket.emit("agent_status", {
                            participantId: global.participantId,
                            meetingId: global.meetingId,
                            ready: true
                        });

                        if (mainWindow) {
                            mainWindow.webContents.send('status-update', {
                                status: 'Linked & Connected',
                                agentId: AGENT_ID,
                                meetingId: global.meetingId
                            });
                        }
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400);
                    res.end('Invalid JSON');
                }
            });
        } else {
            res.writeHead(404);
        }
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${LOCAL_PORT} already in use, skipping local server start.`);
        } else {
            console.error('Local server error:', e);
        }
    });

    server.listen(LOCAL_PORT, '127.0.0.1', () => {
        console.log(`Local agent server running on http://127.0.0.1:${LOCAL_PORT}`);
    });
}

// Protocol Registration
const PROTOCOL = 'replica-agent';
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient(PROTOCOL);
}

function handleProtocolUrl(url) {
    console.log('[AGENT-RECV] Received protocol URL:', url);
    try {
        // Expected format: replica-agent://link/MEETING_ID/PARTICIPANT_ID
        const parsedUrl = new URL(url);
        if (parsedUrl.host === 'link') {
            const parts = parsedUrl.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                global.meetingId = parts[0];
                global.participantId = parts[1];
                console.log(`[AGENT-ID] Identity parsed: Meet=${global.meetingId}, Part=${global.participantId}`);

                if (socket && socket.connected) {
                    emitStatus(true);
                }
            }
        }
    } catch (err) {
        console.error('[AGENT-ERR] Failed to parse protocol URL:', err);
    }
}

function emitStatus(ready) {
    if (global.participantId && global.meetingId) {
        console.log(`[AGENT-EMIT] agent_status: partId=${global.participantId}, ready=${ready}`);
        socket.emit("agent_status", {
            participantId: global.participantId,
            meetingId: global.meetingId,
            ready: !!ready
        });
    }
}

app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
    // Protocol handler for Windows
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
    if (url) handleProtocolUrl(url);
});

app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
});

app.whenReady().then(() => {
    createWindow();

    socket = io(SERVER_URL, {
        transports: ["websocket"],
        secure: true,
        rejectUnauthorized: false
    });

    socket.on('connect', () => {
        console.log('[AGENT] Connected to signaling server');

        // ✅ Register agent (optional but useful)
        socket.emit('agent_register', {
            agentId: AGENT_ID,
            name: 'Electron Agent',
            meetingId: global.meetingId,
            participantId: global.participantId
        });

        // ✅ Send status ONLY if identity exists
        if (global.participantId && global.meetingId) {
            console.log('[AGENT] Sending agent_status:', global.participantId);

            socket.emit("agent_status", {
                participantId: global.participantId,
                meetingId: global.meetingId,
                ready: true
            });
        } else {
            console.log('[AGENT] Waiting for identity (deep link)...');
        }

        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Connected',
                agentId: AGENT_ID
            });
        }
    });

    // ✅ CONTROL START
    socket.on('control_started', (data) => {
        console.log('[AGENT] Control session started by host:', data.hostId);
        global.currentRequestId = data.hostId;
        startStreaming(data.hostId);
        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Controlled by ' + data.hostName,
                agentId: AGENT_ID
            });
        }
    });

    // ✅ HOST INPUT (mouse/keyboard)
    socket.on('host_input_event', (event) => {
        handleInputEvent(event);
    });

    socket.on('control_stopped', () => {
        console.log('[AGENT] Control stopped');
        global.currentRequestId = null;
        stopStreaming();
        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Connected',
                agentId: AGENT_ID
            });
        }
    });

    socket.on('connect_error', (error) => {
        console.error('Connection Error:', error.message);
        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Error: ' + error.message,
                agentId: AGENT_ID
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Disconnected',
                agentId: AGENT_ID
            });
        }
    });
});




startLocalServer();

// Spawn Python Agent Executable
const isDev = !app.isPackaged;
const agentPath = isDev
    ? path.join(__dirname, 'resources', 'agent.exe')
    : path.join(process.resourcesPath, 'agent.exe');

console.log('Starting Python Agent from:', agentPath);

execFile(agentPath, (err, stdout, stderr) => {
    if (err) {
        console.error('Failed to start agent:', err);
        return;
    }
    console.log('Agent started successfully');
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
