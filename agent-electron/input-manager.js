const { spawn } = require('child_process');
const { screen, clipboard } = require('electron');

let robot = null;
let mode = 'fallback';

try {
    robot = require('robotjs');
    mode = 'robotjs';
    console.log('[INPUT] robotjs loaded');
} catch (err) {
    mode = 'fallback';
    console.warn('[INPUT] fallback mode active (RobotJS failed to load)');
}

// PowerShell fallback session
let psProcess = null;
function getPS() {
    if (psProcess && !psProcess.killed) return psProcess;

    psProcess = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    const initCommands = [
        'Add-Type -AssemblyName System.Windows.Forms;',
        'Add-Type -AssemblyName System.Drawing;',
        '$sig = @\'',
        '[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);',
        '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);',
        '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
        '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
        '\'@',
        'Add-Type -MemberDefinition $sig -Name "Win32Input" -Namespace "Win32" -PassThru > $null;'
    ];

    psProcess.stdin.write(initCommands.join('\n') + '\n');
    return psProcess;
}

const KEY_MAP = {
    'control': 'control', 'ctrl': 'control', 'shift': 'shift', 'alt': 'alt',
    'meta': 'command', 'win': 'command', 'command': 'command',
    'enter': 'enter', 'backspace': 'backspace', 'tab': 'tab', 'escape': 'escape',
    'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right', 'space': 'space',
    'home': 'home', 'end': 'end', 'pageup': 'pageup', 'pagedown': 'pagedown',
    'f1': 'f1', 'f2': 'f2', 'f3': 'f3', 'f4': 'f4', 'f5': 'f5', 'f6': 'f6',
    'f7': 'f7', 'f8': 'f8', 'f9': 'f9', 'f10': 'f10', 'f11': 'f11', 'f12': 'f12'
};

const InputManager = {
    getMode() { return mode; },

    /**
     * Ensures the desktop or last active window is focused to receive input.
     */
    async ensureFocus() {
        if (process.platform === 'win32') {
            // Placeholder: On Windows, input methods usually target foreground window anyway.
            // A more aggressive approach would be bringing a specific window to front.
        }
    },

    /**
     * Clipboard Synchronization
     */
    getClipboardText() { return clipboard.readText(); },
    setClipboardText(text) { clipboard.writeText(text); },

    mapCoordinates(x, y, canvasWidth, canvasHeight) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height, x: offsetX, y: offsetY } = primaryDisplay.bounds;
        let targetX = x;
        let targetY = y;

        if (canvasWidth && canvasHeight) {
            targetX = (x / canvasWidth) * width;
            targetY = (y / canvasHeight) * height;
        } else if (x <= 1 && y <= 1) {
            targetX = x * width;
            targetY = y * height;
        }

        return { x: Math.round(targetX + offsetX), y: Math.round(targetY + offsetY) };
    },

    async moveMouse(x, y, relative = false) {
        if (robot) {
            if (relative) {
                const cur = robot.getMousePos();
                robot.moveMouse(cur.x + x, cur.y + y);
            } else {
                robot.moveMouse(x, y);
            }
        } else {
            if (relative) {
                // MOUSEEVENTF_MOVE = 0x0001
                getPS().stdin.write(`[Win32.Win32Input]::mouse_event(0x0001, ${Math.round(x)}, ${Math.round(y)}, 0, 0);\n`);
            } else {
                getPS().stdin.write(`[Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})\n`);
            }
        }
    },

    async mouseDown(button = 'left') {
        if (robot) {
            robot.mouseToggle('down', button);
        } else {
            const flag = button === 'right' ? 0x0008 : (button === 'middle' ? 0x0020 : 0x0002);
            getPS().stdin.write(`[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`);
        }
    },

    async mouseUp(button = 'left') {
        if (robot) {
            robot.mouseToggle('up', button);
        } else {
            const flag = button === 'right' ? 0x0010 : (button === 'middle' ? 0x0040 : 0x0004);
            getPS().stdin.write(`[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`);
        }
    },

    async clickMouse(button = 'left', double = false) {
        if (robot) {
            robot.mouseClick(button, double);
        } else {
            await this.mouseDown(button);
            await this.mouseUp(button);
            if (double) {
                await this.mouseDown(button);
                await this.mouseUp(button);
            }
        }
    },

    async scrollMouse(deltaX, deltaY) {
        if (robot) {
            robot.scrollMouse(deltaX, deltaY);
        } else {
            if (deltaY !== 0) getPS().stdin.write(`[Win32.Win32Input]::mouse_event(0x0800, 0, 0, ${Math.round(deltaY * 120)}, 0);\n`);
            if (deltaX !== 0) getPS().stdin.write(`[Win32.Win32Input]::mouse_event(0x1000, 0, 0, ${Math.round(deltaX * 120)}, 0);\n`);
        }
    },

    async simulateKey(key, isUp = false) {
        const lowerKey = key.toLowerCase();
        const robotKey = KEY_MAP[lowerKey] || lowerKey;

        if (robot) {
            try {
                robot.keyToggle(robotKey, isUp ? 'up' : 'down');
            } catch (e) {
                this._psKeyFallback(key, isUp);
            }
        } else {
            this._psKeyFallback(key, isUp);
        }
    },

    _psKeyFallback(key, isUp) {
        const vkMap = {
            'enter': 0x0D, 'backspace': 0x08, 'tab': 0x09, 'escape': 0x1B,
            'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27, 'space': 0x20,
            'control': 0x11, 'shift': 0x10, 'alt': 0x12, 'meta': 0x5B,
            'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73, 'f5': 0x74, 'f6': 0x75,
            'f7': 0x76, 'f8': 0x77, 'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B
        };
        let vk = vkMap[key.toLowerCase()];
        if (!vk && key.length === 1) vk = key.toUpperCase().charCodeAt(0);

        if (vk) {
            const flag = isUp ? 0x0002 : 0x0000;
            getPS().stdin.write(`[Win32.Win32Input]::keybd_event(${vk}, 0, ${flag}, 0);\n`);
        } else if (!isUp) {
            getPS().stdin.write(`[Windows.Forms.SendKeys]::SendWait('${key.replace(/'/g, "''")}')\n`);
        }
    }
};

module.exports = InputManager;
