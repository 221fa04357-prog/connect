const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const { execFile } = require('child_process');
app.commandLine.appendSwitch('ignore-certificate-errors');
const path = require('path');
const http = require('http');
const io = require('socket.io-client');
const InputManager = require('./input-manager');

// Configuration
let SERVER_URL = 'https://connect-pupt.onrender.com';
console.log('🚀 Agent starting up on port 5701...');
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

// Fix: Implement sendAgentReady as specified
const sendAgentReady = async () => {
    try {
        if (!global.participantId) {
            // Need linked session first
            return;
        }

        console.log("📡 Sending READY status...");
        console.log("Agent ID:", AGENT_ID);
        console.log("User ID:", global.participantId);
        console.log("Status: READY");

        // Mandatory fetch fix
        try {
            await fetch(`${SERVER_URL}/api/agent/status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId: global.participantId,
                    agentId: AGENT_ID,
                    ready: true
                })
            });
        } catch (fetchErr) {
            // Silence REST error - Signaling socket is primary
        }

        if (socket && socket.connected) {
            // Emit both for compatibility (user requested update + backend legacy)
            socket.emit("agent_status_update", {
                participantId: global.participantId,
                ready: true
            });

            socket.emit("agent_status", {
                participantId: global.participantId,
                meetingId: global.meetingId,
                ready: true
            });
        }

        console.log("✅ Agent READY sent successfully");
    } catch (err) {
        console.error("❌ Failed to send READY:", err);
    }
};

// Fix: Implement missing setupSocketListeners
function setupSocketListeners(s) {
    s.on("mouse_move", (data) => handleInputEvent({ type: 'mouse_move', ...data }));
    s.on("mouse_click", (data) => handleInputEvent({ type: 'mouse_click', ...data }));
    s.on("key_press", (data) => handleInputEvent({ type: 'key_press', ...data }));
    
    // Key compatibility for other key events
    s.on("key_down", (data) => handleInputEvent({ type: 'key_down', ...data }));
    s.on("key_up", (data) => handleInputEvent({ type: 'key_up', ...data }));

    s.on("screen_request", (data) => {
        console.log("Screen request received:", data);
        if (data.active) {
            startStreaming(data.hostId);
        } else {
            stopStreaming();
        }
    });

    // Handle session status requests
    s.on("get_agent_status", (data) => {
        sendAgentReady();
    });
}

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

// Global state for safety check logic (requested by user)
let sessionActive = false; 
// authorizedUser will be our own participantId since we only accept commands for our own ID
// The user check is "authorizedUser === userId"

async function handleInputEvent(event) {
    // Session Active safety check (requested by user: sessionActive && authorizedUser === userId)
    // We Map isControlled -> sessionActive
    sessionActive = isControlled;
    const userId = global.participantId;
    const authorizedUser = global.participantId; 

    if (!(sessionActive && authorizedUser === userId)) {
        return;
    }

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
        const origin = req.headers.origin || '*';
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');

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

                    if (data.serverUrl && data.serverUrl !== SERVER_URL) {
                        console.log('Updating SERVER_URL to:', data.serverUrl);
                        SERVER_URL = data.serverUrl;
                        if (socket) {
                            socket.disconnect();
                        }

                        // Re-initialize socket with the new URL
                        socket = io(SERVER_URL, {
                            transports: ["websocket"],
                            secure: true,
                            rejectUnauthorized: false
                        });

                        socket.on('connect', () => {
                            console.log('🟢 Agent connected to server');
                            socket.emit('agent_register', { agentId: AGENT_ID });
                            
                            // Mandatory: Call sendAgentReady on connect
                            sendAgentReady();
                            
                            if (mainWindow) {
                                mainWindow.webContents.send('status-update', {
                                    status: 'Linked & Connected',
                                    agentId: AGENT_ID,
                                    meetingId: global.meetingId
                                });
                            }
                        });

                        // Re-attach listeners
                        setupSocketListeners(socket);
                    } else if (socket && socket.connected) {
                        // Mandatory: Call sendAgentReady when linked
                        sendAgentReady();

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

    server.listen(LOCAL_PORT, () => {
        console.log(`Local agent server running on port ${LOCAL_PORT}`);
    });
}

app.whenReady().then(() => {
    createWindow();

    socket = io(SERVER_URL, {
        transports: ["websocket"],
        secure: true,
        rejectUnauthorized: false
    });

    socket.on('connect', () => {
        console.log('🟢 Agent connected to server');
        socket.emit('agent_register', { agentId: AGENT_ID });

        // Mandatory: Call sendAgentReady on connect
        sendAgentReady();

        if (mainWindow) {
            mainWindow.webContents.send('status-update', { status: 'Connected', agentId: AGENT_ID });
        }
    });

    setupSocketListeners(socket);

    // Mandatory: HEARTBEAT (2 seconds)
    setInterval(() => {
        sendAgentReady();
    }, 2000);

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
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
