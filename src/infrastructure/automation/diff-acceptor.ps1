param(
    [string]$TargetTitle = "Antigravity"
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32DiffAcceptor {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_MENU = 0x12;    // Alt key
    public const byte VK_RETURN = 0x0D;  // Enter key

    public static IntPtr FoundHwnd = IntPtr.Zero;

    public static bool FindWindowCallback(IntPtr hWnd, IntPtr lParam) {
        StringBuilder classSb = new StringBuilder(256);
        GetClassName(hWnd, classSb, 256);
        string className = classSb.ToString();

        if (className == "Chrome_WidgetWin_1") {
            StringBuilder textSb = new StringBuilder(512);
            GetWindowText(hWnd, textSb, 512);
            string title = textSb.ToString();

            if (title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0) {
                FoundHwnd = hWnd;
                return false;
            }
        }
        return true;
    }

    public static bool BringToFront(IntPtr hWnd) {
        IntPtr fgHwnd = GetForegroundWindow();
        if (fgHwnd == hWnd) return true;

        uint fgThread = GetWindowThreadProcessId(fgHwnd, out _);
        uint curThread = GetCurrentThreadId();

        AttachThreadInput(curThread, fgThread, true);
        bool res = SetForegroundWindow(hWnd);
        AttachThreadInput(curThread, fgThread, false);
        return res;
    }

    public static void SendAltEnter() {
        // Press Alt
        keybd_event(VK_MENU, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        
        // Press Enter
        keybd_event(VK_RETURN, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        
        // Release Enter
        keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        
        // Release Alt
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@ -ErrorAction SilentlyContinue

[Win32DiffAcceptor]::FoundHwnd = [IntPtr]::Zero
[Win32DiffAcceptor]::EnumWindows([Win32DiffAcceptor+EnumWindowsProc][Win32DiffAcceptor]::FindWindowCallback, [IntPtr]::Zero)

$targetHwnd = [Win32DiffAcceptor]::FoundHwnd

if ($targetHwnd -ne [IntPtr]::Zero) {
    [Win32DiffAcceptor]::BringToFront($targetHwnd)
    Start-Sleep -Milliseconds 150
    [Win32DiffAcceptor]::SendAltEnter()
    Write-Output "SUCCESS: Alt+Enter injected to Antigravity IDE ($targetHwnd)"
} else {
    Write-Output "WARNING: Antigravity IDE window not found. Skipped Win32 Alt+Enter."
}
