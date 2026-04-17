const { app, BrowserWindow, screen, desktopCapturer, globalShortcut } = require('electron');
app.commandLine.appendSwitch('ignore-certificate-errors');
const io = require('socket.io-client');
const InputManager = require('./input-manager');

// Configuration
const SERVER_URL = 'https://connect-pupt.onrender.com';
let socket;
let mainWindow;
let isControlled = false;
let isControlAllowed = false;
let activeSessionToken = null;
const AGENT_ID = 'AGENT-' + Math.random().toString(36).substr(2, 9).toUpperCase();

// Adaptive Performance State
let frameFPS = 20;
let frameQuality = 75;
let lastCpuCheck = 0;

// Input Queue
const eventQueue = [];
const QUEUE_PROCESS_INTERVAL = 10; // Process events every 10ms to handle jitter

function setupEventListeners() {
    socket.removeAllListeners();

    socket.on('connect', () => {
        console.log('[SOCKET] Linked to signaling server');
        socket.emit("agent_idle_connect", { agentId: AGENT_ID });
    });

    socket.on("manual_link_received", (data) => {
        global.meetingId = data.meetingId;
        global.participantId = data.participantId;
        socket.emit("agent_status", { agentId: AGENT_ID, meetingId: data.meetingId, participantId: data.participantId, ready: true });
    });

    socket.on('control_started', (data) => {
        activeSessionToken = data?.token || "SESSION_SECURE_PROTO";
        startStreaming(data.hostId, data.participantId || global.participantId);
    });

    socket.on('control_stopped', stopStreaming);

    // Clipboard Sync Event
    socket.on('clipboard_update', (data) => {
        if (isControlAllowed && data.text) {
            InputManager.setClipboardText(data.text);
            console.log('[CLIPBOARD] Synced text from participant');
        }
    });

    const handleIncomingInput = (event) => {
        const payload = event?.event || event;
        // SESSION VALIDATION
        if (activeSessionToken && payload.token && payload.token !== activeSessionToken) {
            console.warn('[SECURITY] Unauthorized input attempt blocked.');
            return;
        }

        // OPTIMIZATION: If queue has multiple mouse moves, discard the oldest ones
        // to prevent "rubber banding" / cursor delay during network spikes.
        if (payload.type === 'mouse_move') {
            const lastMoveIndex = eventQueue.findLastIndex(e => e.type === 'mouse_move');
            if (lastMoveIndex !== -1 && eventQueue.length > 5) {
                // If there are already moves in queue, replace the last one or remove it
                // To keep the queue short and responsive.
                eventQueue.splice(lastMoveIndex, 1);
            }
        }

        eventQueue.push(payload);
    };

    socket.on('host_input_event', handleIncomingInput);
    socket.on('input_event', handleIncomingInput);
}

// Process Input Queue systematically
setInterval(async () => {
    if (eventQueue.length === 0 || !isControlAllowed) return;
    
    const event = eventQueue.shift();
    await handleInputEvent(event);
}, QUEUE_PROCESS_INTERVAL);

async function handleInputEvent(event) {
    try {
        const { type, x, y, dx, dy, button, key, deltaX, deltaY, canvasWidth, canvasHeight, isRelative } = event;

        // Ensure focus for keyboard input
        if (type.startsWith('key_')) {
            await InputManager.ensureFocus();
        }

        switch (type) {
            case 'mouse_move':
                if (isRelative) {
                    await InputManager.moveMouse(dx || 0, dy || 0, true);
                } else {
                    const coords = InputManager.mapCoordinates(x, y, canvasWidth, canvasHeight);
                    await InputManager.moveMouse(coords.x, coords.y);
                }
                break;
            case 'mouse_down': await InputManager.mouseDown(button || 'left'); break;
            case 'mouse_up': await InputManager.mouseUp(button || 'left'); break;
            case 'mouse_click': await InputManager.clickMouse(button || 'left', event.double || false); break;
            case 'mouse_wheel': await InputManager.scrollMouse(deltaX || 0, deltaY || 0); break;
            case 'key_down': case 'key_press': await InputManager.simulateKey(key, false); break;
            case 'key_up': await InputManager.simulateKey(key, true); break;
            case 'clipboard_request':
                const text = InputManager.getClipboardText();
                socket.emit('agent_clipboard', { text });
                break;
            default: console.warn(`[DEBUG] Unknown event type: ${type}`);
        }
    } catch (err) {
        console.error('[ERROR] Input execution failure:', err);
    }
}

// Adaptive Performance Control
function monitorPerformance() {
    const now = Date.now();
    if (now - lastCpuCheck > 5000) {
        // Mock CPU check/load detection
        // If high load, reduce frame rate to save battery/local perf
        const isHighLoad = false; // In a real app we'd use process.getCPUUsage()
        if (isHighLoad) {
            frameFPS = 10;
            frameQuality = 50;
        } else {
            frameFPS = 24;
            frameQuality = 75;
        }
        lastCpuCheck = now;
    }
}

let captureTimeout;
async function captureLoop(hostId, participantId) {
    if (!isControlled) return;
    monitorPerformance();
    try {
        const start = Date.now();
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        if (sources.length > 0) {
            const screenSource = sources[0];
            const thumb = screenSource.thumbnail;
            if (!thumb.isEmpty()) {
                const jpegBuffer = thumb.toJPEG(frameQuality);
                const base64 = jpegBuffer.toString('base64');
                socket.emit('agent_frame', { hostId, participantId, frame: `data:image/jpeg;base64,${base64}` });
            }
        }

        const elapsed = Date.now() - start;
        const delay = Math.max(0, (1000 / frameFPS) - elapsed);
        if (isControlled) captureTimeout = setTimeout(() => captureLoop(hostId, participantId), delay);
    } catch (err) {
        if (isControlled) captureTimeout = setTimeout(() => captureLoop(hostId, participantId), 100);
    }
}

async function startStreaming(hostId, participantId) {
    if (captureTimeout) clearTimeout(captureTimeout);
    isControlled = true;
    isControlAllowed = true;
    captureLoop(hostId, participantId);
}

function stopStreaming() {
    console.log('[SAFETY] Terminating session and releasing input.');
    if (captureTimeout) clearTimeout(captureTimeout);
    
    // DRAG SAFETY: Release all mouse buttons on stop
    InputManager.mouseUp('left');
    InputManager.mouseUp('right');
    InputManager.mouseUp('middle');

    isControlled = false;
    isControlAllowed = false;
    activeSessionToken = null;
    eventQueue.length = 0; // Clear pending events
}

app.whenReady().then(async () => {
    globalShortcut.register('CommandOrControl+Shift+Q', stopStreaming);
    createWindow();
    socket = io(SERVER_URL, { transports: ["websocket"], secure: true, reconnection: true });
    setupEventListeners();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
