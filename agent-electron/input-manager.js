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
        '$sig = \'[DllImport("user32.dll")] public static extern void mouse_event(int f, int dx, int dy, int d, int e);\';',
        'Add-Type -MemberDefinition $sig -Name "Win32Mouse" -Namespace "Win32" -PassThru > $null;'
    ];

    psProcess.stdin.write(initCommands.join('\n') + '\n');
    psProcess.stderr.on('data', (data) => console.error(`PS Error: ${data}`));

    console.log('Using persistent PowerShell for input simulation');
    return psProcess;
}

const InputManager = {
    /**
     * Moves mouse to absolute coordinates.
     * @param {number} x 
     * @param {number} y 
     */
    async moveMouse(x, y) {
        const command = `[Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})\n`;
        getPS().stdin.write(command);
    },

    /**
     * Clicks the mouse.
     * @param {string} button 'left', 'right', 'middle'
     * @param {boolean} double 
     */
    async clickMouse(button = 'left', double = false) {
        const MOUSEEVENTF_LEFTDOWN = 0x0002;
        const MOUSEEVENTF_LEFTUP = 0x0004;
        const MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const MOUSEEVENTF_RIGHTUP = 0x0010;
        const MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        const MOUSEEVENTF_MIDDLEUP = 0x0040;

        let down, up;
        if (button === 'right') {
            down = MOUSEEVENTF_RIGHTDOWN;
            up = MOUSEEVENTF_RIGHTUP;
        } else if (button === 'middle') {
            down = MOUSEEVENTF_MIDDLEDOWN;
            up = MOUSEEVENTF_MIDDLEUP;
        } else {
            down = MOUSEEVENTF_LEFTDOWN;
            up = MOUSEEVENTF_LEFTUP;
        }

        const clickCode = `[Win32.Win32Mouse]::mouse_event(${down}, 0, 0, 0, 0); [Win32.Win32Mouse]::mouse_event(${up}, 0, 0, 0, 0);\n`;
        getPS().stdin.write(clickCode);
        if (double) getPS().stdin.write(clickCode);
    },

    /**
     * Simulates a key press.
     * @param {string} key 
     */
    async typeKey(key) {
        const keyMap = {
            'enter': '{ENTER}', 'backspace': '{BACKSPACE}', 'tab': '{TAB}',
            'escape': '{ESC}', 'up': '{UP}', 'down': '{DOWN}',
            'left': '{LEFT}', 'right': '{RIGHT}', 'space': ' '
        };
        const mappedKey = keyMap[key.toLowerCase()] || key;
        const command = `[Windows.Forms.SendKeys]::SendWait('${mappedKey.replace(/'/g, "''")}')\n`;
        getPS().stdin.write(command);
    }
};

module.exports = InputManager;
