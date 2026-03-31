const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
app.commandLine.appendSwitch('ignore-certificate-errors');
const io = require('socket.io-client');
const InputManager = require('./input-manager');

// Configuration
let SERVER_URL = 'https://connect-pupt.onrender.com';
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

app.whenReady().then(() => {
    createWindow();

    socket = io(SERVER_URL, {
        transports: ["websocket"],
        secure: true,
        rejectUnauthorized: false
    });

    socket.on('connect', () => {
        console.log('Connected to signaling server');
        
        // --- NEW AUTO-LINK BEHAVIOR ---
        // Emit agent_idle_connect instead of agent_status on initial boot
        socket.emit("agent_idle_connect", { agentId: AGENT_ID });

        if (mainWindow) {
            mainWindow.webContents.send('status-update', { status: 'Connected', agentId: AGENT_ID });
        }
    });
    
    // Listen for manual or auto link pairing from backend
    socket.on("manual_link_received", ({ meetingId, participantId }) => {
        console.log(`[LINK] Assigned to participant ${participantId} in meeting ${meetingId}`);
        global.meetingId = meetingId;
        global.participantId = participantId;

        socket.emit("agent_status", {
            agentId: AGENT_ID,
            meetingId,
            participantId,
            ready: true
        });

        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Linked & Connected',
                agentId: AGENT_ID,
                meetingId: global.meetingId
            });
        }
    });

    // ✅ CONTROL START
    socket.on('control_started', (data) => {
        const hostId = data?.hostId;
        if (!hostId) return;
        startStreaming(hostId);
        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Controlled by Host',
                agentId: AGENT_ID
            });
        }
    });

    // ✅ HOST INPUT (mouse/keyboard)
    socket.on('host_input_event', (event) => {
        if (event && event.event) { // Backend wraps it, handle generic or wrapped
             handleInputEvent(event.event);
        } else {
             handleInputEvent(event);
        }
    });

    // ✅ CONTROL STOP
    socket.on('control_stopped', () => {
        console.log('[AGENT] Control stopped');
        global.currentRequestId = null;
        stopStreaming();

        if (mainWindow) {
            mainWindow.webContents.send('status-update', {
                status: 'Linked & Connected',
                agentId: AGENT_ID,
                meetingId: global.meetingId
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
