const { spawn } = require('child_process');

// Persistent PowerShell session
let psProcess = null;
function getPS() {
    if (psProcess && !psProcess.killed) return psProcess;

    psProcess = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    // Initialize common types and Win32 API
    const initCommands = [
        '[Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms") | Out-Null',
        '[Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null',
        '$sig = @\'',
        '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
        '[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uint dwExtraInfo);',
        '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo);',
        '\'@',
        'Add-Type -MemberDefinition $sig -Name "Win32Input" -Namespace "Win32" -PassThru | Out-Null'
    ];

    psProcess.stdin.write(initCommands.join('\n') + '\n');
    
    // Check for success
    psProcess.stdin.write('if ([Win32.Win32Input]) { "WIN32_READY" } else { "WIN32_FAILED" }\n');
    
    psProcess.stderr.on('data', (data) => {
        const err = data.toString();
        if (err.includes('Error') || err.includes('Exception')) {
            console.error(`[PS ERROR] ${err}`);
        }
    });
    
    psProcess.stdout.on('data', (data) => {
        const out = data.toString();
        if (out.includes('WIN32_READY')) {
            console.log('[INPUT] Win32 API successfully injected into PowerShell');
        }
        // console.log(`[PS OUT] ${data}`);
    });

    psProcess.on('exit', (code) => {
        console.warn(`[PS EXIT] PowerShell process exited with code ${code}. Restarting...`);
        psProcess = null;
    });

    console.log('[INPUT] Using persistent PowerShell session');
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
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);
        console.log(`[INPUT] Moving mouse to: ${roundedX}, ${roundedY}`);
        const command = `[Win32.Win32Input]::SetCursorPos(${roundedX}, ${roundedY});\n`;
        getPS().stdin.write(command);
    },

    /**
     * mouseDown simulation.
     */
    async mouseDown(button = 'left') {
        console.log(`[INPUT] Mouse DOWN: ${button}`);
        const flag = button === 'right' ? this.MOUSE_FLAGS.RIGHTDOWN : 
                     button === 'middle' ? this.MOUSE_FLAGS.MIDDLEDOWN : this.MOUSE_FLAGS.LEFTDOWN;
        const command = `[Win32.Win32Input]::mouse_event(${flag}, 0, 0, 0, 0);\n`;
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
        console.log(`[INPUT] Clicking mouse: ${button} (double: ${double})`);
        const flagDown = button === 'right' ? this.MOUSE_FLAGS.RIGHTDOWN : 
                         button === 'middle' ? this.MOUSE_FLAGS.MIDDLEDOWN : this.MOUSE_FLAGS.LEFTDOWN;
        const flagUp = button === 'right' ? this.MOUSE_FLAGS.RIGHTUP : 
                       button === 'middle' ? this.MOUSE_FLAGS.MIDDLEUP : this.MOUSE_FLAGS.LEFTUP;
        
        let command = `[Win32.Win32Input]::mouse_event(${flagDown}, 0, 0, 0, 0); `;
        command += `Start-Sleep -m 50; `;
        command += `[Win32.Win32Input]::mouse_event(${flagUp}, 0, 0, 0, 0);\n`;
        
        if (double) {
            command += `Start-Sleep -m 100; `;
            command += `[Win32.Win32Input]::mouse_event(${flagDown}, 0, 0, 0, 0); `;
            command += `Start-Sleep -m 50; `;
            command += `[Win32.Win32Input]::mouse_event(${flagUp}, 0, 0, 0, 0);\n`;
        }
        
        getPS().stdin.write(command);
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
                // Escape special characters for SendKeys
                const escapedKey = key.replace(/([+^%~(){}[\]])/g, '{$1}').replace(/'/g, "''");
                const command = `[System.Windows.Forms.SendKeys]::SendWait('${escapedKey}')\n`;
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
