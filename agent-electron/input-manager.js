const { spawn } = require('child_process');

// Persistent PowerShell session
let psPromise = null;

function getPS() {
    if (psProcess && !psProcess.killed && psPromise) return psPromise;

    psPromise = new Promise((resolve, reject) => {
        psProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', '-'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Initialize common types
        const initCommands = [
            'Add-Type -AssemblyName System.Windows.Forms;',
            'Add-Type -AssemblyName System.Drawing;',
            '$sig = @\'',
            '[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);',
            '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);',
            '\'@',
            'Add-Type -MemberDefinition $sig -Name "Win32Input" -Namespace "Win32" -PassThru > $null;',
            'Write-Host "[PS_READY]"'
        ];

        let isReady = false;

        psProcess.stdout.on('data', (data) => {
            const output = data.toString();
            // console.log(`[PS OUT] ${output.trim()}`);
            if (output.includes('[PS_READY]') && !isReady) {
                isReady = true;
                console.log('[INPUT] PowerShell session is ready');
                resolve(psProcess);
            }
        });

        psProcess.stderr.on('data', (data) => console.error(`[PS ERROR] ${data}`));

        psProcess.on('exit', (code) => {
            console.warn(`[PS EXIT] PowerShell process exited with code ${code}. Restarting...`);
            psProcess = null;
            psPromise = null;
            if (!isReady) reject(new Error('PowerShell exited before ready'));
        });

        console.log('[INPUT] Starting persistent PowerShell session...');
        psProcess.stdin.write(initCommands.join('\n') + '\n');
    });

    return psPromise;
}

const InputManager = {
    /** Mouse Flags */
    MOUSE_FLAGS: {
        LEFTDOWN: 0x0002, LEFTUP: 0x0004,
        RIGHTDOWN: 0x0008, RIGHTUP: 0x0010,
        MIDDLEDOWN: 0x0020, MIDDLEUP: 0x0040
    },

    /** Keyboard Flags */
    KEY_FLAGS: {
        KEYDOWN: 0x0000,
        KEYUP: 0x0002
    },

    /**
     * Moves mouse to absolute coordinates.
     */
    async moveMouse(x, y) {
        const ps = await getPS();
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);
        const command = `[Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${roundedX}, ${roundedY})\n`;
        ps.stdin.write(command);
    },

    /**
     * mouseDown simulation.
     */
    async mouseDown(button = 'left') {
        const ps = await getPS();
        const flag = button === 'right' ? this.MOUSE_FLAGS.RIGHTDOWN : 
                     button === 'middle' ? this.MOUSE_FLAGS.MIDDLEDOWN : this.MOUSE_FLAGS.LEFTDOWN;
        const command = `[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`;
        ps.stdin.write(command);
    },

    /**
     * mouseUp simulation.
     */
    async mouseUp(button = 'left') {
        const ps = await getPS();
        const flag = button === 'right' ? this.MOUSE_FLAGS.RIGHTUP : 
                     button === 'middle' ? this.MOUSE_FLAGS.MIDDLEUP : this.MOUSE_FLAGS.LEFTUP;
        const command = `[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`;
        ps.stdin.write(command);
    },

    /**
     * Clicks the mouse.
     */
    async clickMouse(button = 'left', double = false) {
        await this.mouseDown(button);
        await this.mouseUp(button);
        if (double) {
            await this.mouseDown(button);
            await this.mouseUp(button);
        }
    },

    /**
     * Simulates a key event (down/up).
     */
    async simulateKey(key, isUp = false) {
        const ps = await getPS();
        const vkMap = {
            'enter': 0x0D, 'backspace': 0x08, 'tab': 0x09, 'escape': 0x1B,
            'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27, 'space': 0x20,
            'control': 0x11, 'shift': 0x10, 'alt': 0x12, 'meta': 0x5B // Windows key
        };
        
        let vk = vkMap[key.toLowerCase()];
        if (!vk && key.length === 1) {
            // Basic ASCII to VK mapping (A-Z, 0-9)
            vk = key.toUpperCase().charCodeAt(0);
        }

        if (vk) {
            const flag = isUp ? this.KEY_FLAGS.KEYUP : this.KEY_FLAGS.KEYDOWN;
            const command = `[Win32.Win32Input]::keybd_event(${vk}, 0, ${flag}, 0);\n`;
            ps.stdin.write(command);
        } else {
            // Fallback for typing whole strings or complex keys on key_down
            if (!isUp) {
                const command = `[Windows.Forms.SendKeys]::SendWait('${key.replace(/'/g, "''")}')\n`;
                ps.stdin.write(command);
            }
        }
    },

    /**
     * Legacy helper kept for compatibility
     */
    async typeKey(key) {
        await this.simulateKey(key, false);
        await this.simulateKey(key, true);
    }
};

module.exports = InputManager;
