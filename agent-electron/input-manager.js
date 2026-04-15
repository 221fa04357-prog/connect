const { spawn } = require('child_process');

// Persistent PowerShell session
let psProcess = null;
function getPS() {
    if (psProcess && !psProcess.killed) return psProcess;

    psProcess = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
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
        'Add-Type -MemberDefinition $sig -Name "Win32Input" -Namespace "Win32" -PassThru > $null;'
    ];

    psProcess.stdin.write(initCommands.join('\n') + '\n');
    psProcess.stderr.on('data', (data) => console.error(`PS Error: ${data}`));

    console.log('Using persistent PowerShell for input simulation');
    return psProcess;
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
        const command = `[Win32.Win32Input]::SetCursorPos(${Math.round(x)}, ${Math.round(y)});\n`;
        console.log(`[PS-EXEC] Executing: ${command.trim()}`);
        getPS().stdin.write(command);
    },

    /**
     * mouseDown simulation.
     */
    async mouseDown(button = 'left') {
        const flag = button === 'right' ? this.MOUSE_FLAGS.RIGHTDOWN : 
                     button === 'middle' ? this.MOUSE_FLAGS.MIDDLEDOWN : this.MOUSE_FLAGS.LEFTDOWN;
        const command = `[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`;
        console.log(`[PS-EXEC] Executing: ${command.trim()}`);
        getPS().stdin.write(command);
    },

    /**
     * mouseUp simulation.
     */
    async mouseUp(button = 'left') {
        const flag = button === 'right' ? this.MOUSE_FLAGS.RIGHTUP : 
                     button === 'middle' ? this.MOUSE_FLAGS.MIDDLEUP : this.MOUSE_FLAGS.LEFTUP;
        const command = `[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`;
        getPS().stdin.write(command);
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
            getPS().stdin.write(command);
        } else {
            // Fallback for typing whole strings or complex keys on key_down
            if (!isUp) {
                const command = `[Windows.Forms.SendKeys]::SendWait('${key.replace(/'/g, "''")}')\n`;
                getPS().stdin.write(command);
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
