# clipboard-injector.ps1 - Text Clipboard Injection for Antigravity IDE
param (
    [string]$Text = "",
    [string]$TargetTitle = "Antigravity IDE",
    [string]$ProcessName = "Antigravity IDE",
    [int]$FocusDelayMs = 400,
    [int]$PasteDelayMs = 250,
    [switch]$SendEnter = $true,
    [string]$FocusShortcut = "Auto", # "Auto", "Ctrl+Alt+I", "Ctrl+L", "Ctrl+Shift+I", "None"
    [string]$Method = "keybd_event",
    [switch]$NewChat = $false
)

$code = @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class Win32ClipboardInjector {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool AllowSetForegroundWindow(int dwProcessId);

    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool OpenIcon(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_SHOWWINDOW = 0x0040;
    public const uint SWP_FLAGS = SWP_NOSIZE | SWP_NOMOVE | SWP_SHOWWINDOW;

    public const byte VK_MENU = 0x12;    // Alt key
    public const byte VK_SHIFT = 0x10;   // Shift key
    public const byte VK_CONTROL = 0x11; // Ctrl key
    public const byte VK_I = 0x49;       // I key
    public const byte VK_L = 0x4C;       // L key
    public const byte VK_N = 0x4E;       // N key
    public const byte VK_P = 0x50;       // P key
    public const byte VK_V = 0x56;       // V key
    public const byte VK_RETURN = 0x0D;  // Enter key
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const int ASFW_ANY = -1;
    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    public class InjectResult {
        public bool Success;
        public string HWND;
        public uint PID;
        public string Title;
        public string TextInjected;
        public string Error;
    }

    public static void BringToTopZOrder(IntPtr targetHwnd) {
        IntPtr fgHwnd = GetForegroundWindow();
        uint dummy;
        uint fgThread = GetWindowThreadProcessId(fgHwnd, out dummy);
        uint targetThread = GetWindowThreadProcessId(targetHwnd, out dummy);
        uint curThread = GetCurrentThreadId();

        bool attachedFg = false;
        bool attachedTarget = false;

        if (fgThread != curThread && fgThread != 0) {
            attachedFg = AttachThreadInput(curThread, fgThread, true);
        }
        if (targetThread != curThread && targetThread != 0) {
            attachedTarget = AttachThreadInput(curThread, targetThread, true);
        }

        AllowSetForegroundWindow(ASFW_ANY);

        if (IsIconic(targetHwnd)) {
            OpenIcon(targetHwnd);
            ShowWindowAsync(targetHwnd, SW_RESTORE);
        } else {
            ShowWindowAsync(targetHwnd, SW_SHOW);
        }

        SetWindowPos(targetHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS);
        SetWindowPos(targetHwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_FLAGS);

        BringWindowToTop(targetHwnd);
        SetForegroundWindow(targetHwnd);
        SwitchToThisWindow(targetHwnd, true);

        if (attachedTarget) AttachThreadInput(curThread, targetThread, false);
        if (attachedFg) AttachThreadInput(curThread, fgThread, false);
    }

    public static void SendKeybd(byte vk, bool keyUp) {
        uint flags = keyUp ? KEYEVENTF_KEYUP : 0;
        keybd_event(vk, 0, flags, UIntPtr.Zero);
    }

    public static void SendCtrlL() {
        SendKeybd(VK_CONTROL, false); Thread.Sleep(30);
        SendKeybd(VK_L, false); Thread.Sleep(30);
        SendKeybd(VK_L, true); Thread.Sleep(30);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftL() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false); Thread.Sleep(30);
        SendKeybd(VK_L, false); Thread.Sleep(30);
        SendKeybd(VK_L, true); Thread.Sleep(30);
        SendKeybd(VK_SHIFT, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlAltI() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_MENU, false); Thread.Sleep(30);
        SendKeybd(VK_I, false); Thread.Sleep(30);
        SendKeybd(VK_I, true); Thread.Sleep(30);
        SendKeybd(VK_MENU, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftI() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false); Thread.Sleep(30);
        SendKeybd(VK_I, false); Thread.Sleep(30);
        SendKeybd(VK_I, true); Thread.Sleep(30);
        SendKeybd(VK_SHIFT, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftP() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false); Thread.Sleep(30);
        SendKeybd(VK_P, false); Thread.Sleep(30);
        SendKeybd(VK_P, true); Thread.Sleep(30);
        SendKeybd(VK_SHIFT, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendPasteKeybdEvent() {
        SendKeybd(VK_CONTROL, false); Thread.Sleep(40);
        SendKeybd(VK_V, false); Thread.Sleep(40);
        SendKeybd(VK_V, true); Thread.Sleep(40);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendEnterKeybdEvent() {
        SendKeybd(VK_RETURN, false); Thread.Sleep(40);
        SendKeybd(VK_RETURN, true);
    }

    public static void FocusChatViaSmartResetSequence() {
        // Smart Reset & Focus Sequence:
        // 1. Send Ctrl+L (Toggles/Resets active panel focus)
        SendCtrlL();
        Thread.Sleep(200);

        // 2. Send Ctrl+L again (Guarantees opening & focusing chat input box)
        SendCtrlL();
        Thread.Sleep(250);

        // 3. Command Palette "Code with Agent" backup
        SendCtrlShiftP();
        Thread.Sleep(150);
        Thread staThread = new Thread(() => {
            try {
                Clipboard.SetText("Code with Agent");
            } catch {}
        });
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();
        staThread.Join();

        SendPasteKeybdEvent();
        Thread.Sleep(120);
        SendEnterKeybdEvent();
        Thread.Sleep(200);
    }

    public static void NewChatViaCommandPalette() {
        SendCtrlShiftL();
        Thread.Sleep(150);

        SendCtrlShiftP();
        Thread.Sleep(150);
        Thread staThread = new Thread(() => {
            try {
                Clipboard.SetText("New Conversation");
            } catch {}
        });
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();
        staThread.Join();

        SendPasteKeybdEvent();
        Thread.Sleep(120);
        SendEnterKeybdEvent();
        Thread.Sleep(200);
    }

    public static InjectResult InjectText(string text, string targetTitle, string targetProcName, int focusDelayMs, int pasteDelayMs, bool submitEnter, string focusShortcut, string method, bool isNewChat) {
        InjectResult res = new InjectResult {
            Success = false,
            HWND = "0x0",
            PID = 0,
            Title = "",
            TextInjected = text,
            Error = null
        };

        try {
            IntPtr bestHwnd = IntPtr.Zero;
            string bestTitle = "";
            uint bestPid = 0;

            HashSet<uint> targetPids = new HashSet<uint>();
            Process[] procs = Process.GetProcesses();
            foreach (Process p in procs) {
                try {
                    if (!string.IsNullOrEmpty(targetProcName) &&
                        p.ProcessName.IndexOf(targetProcName, StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetPids.Add((uint)p.Id);
                    }
                } catch {}
            }

            EnumWindows((hWnd, lParam) => {
                uint pid = 0;
                GetWindowThreadProcessId(hWnd, out pid);

                string pName = "";
                try {
                    Process p = Process.GetProcessById((int)pid);
                    if (p != null) pName = p.ProcessName;
                } catch {}

                if (pName.IndexOf("chrome", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    pName.IndexOf("msedge", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    pName.IndexOf("firefox", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    pName.IndexOf("brave", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    pName.IndexOf("opera", StringComparison.OrdinalIgnoreCase) >= 0) {
                    return true;
                }

                bool isTargetPid = targetPids.Contains(pid);

                int length = GetWindowTextLength(hWnd);
                string title = "";
                if (length > 0) {
                    StringBuilder sb = new StringBuilder(length + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    title = sb.ToString();
                }

                bool titleMatch = !string.IsNullOrEmpty(targetTitle) &&
                                  title.IndexOf(targetTitle, StringComparison.OrdinalIgnoreCase) >= 0;

                if (isTargetPid || titleMatch) {
                    if (IsWindowVisible(hWnd) || bestHwnd == IntPtr.Zero) {
                        bestHwnd = hWnd;
                        bestTitle = title;
                        bestPid = pid;
                        if (IsWindowVisible(hWnd) && (titleMatch || !string.IsNullOrEmpty(title))) {
                            return false;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (bestHwnd == IntPtr.Zero) {
                res.Error = "Antigravity IDE window not found. (Make sure process 'Antigravity IDE' is running).";
                return res;
            }

            // Bring target window to top Z-Order
            BringToTopZOrder(bestHwnd);
            Thread.Sleep(focusDelayMs);

            if (isNewChat) {
                NewChatViaCommandPalette();
                res.Success = true;
                res.HWND = "0x" + bestHwnd.ToInt64().ToString("X");
                res.PID = bestPid;
                res.Title = bestTitle;
                return res;
            }

            // Handle Focus Shortcut
            if (focusShortcut.Equals("Auto", StringComparison.OrdinalIgnoreCase) ||
                focusShortcut.Equals("CommandPalette", StringComparison.OrdinalIgnoreCase)) {
                FocusChatViaSmartResetSequence();
            } else if (focusShortcut.Equals("Ctrl+Alt+I", StringComparison.OrdinalIgnoreCase)) {
                SendCtrlAltI();
                Thread.Sleep(150);
            } else if (focusShortcut.Equals("Ctrl+L", StringComparison.OrdinalIgnoreCase)) {
                SendCtrlL();
                Thread.Sleep(200);
                SendCtrlL();
                Thread.Sleep(200);
            } else if (focusShortcut.Equals("Ctrl+Shift+I", StringComparison.OrdinalIgnoreCase)) {
                SendCtrlShiftI();
                Thread.Sleep(150);
            }

            if (!string.IsNullOrEmpty(text)) {
                // Set Clipboard Text using STA thread
                Thread staThreadText = new Thread(() => {
                    try {
                        Clipboard.SetText(text);
                    } catch (Exception ex) {
                        res.Error = "Clipboard error: " + ex.Message;
                    }
                });
                staThreadText.SetApartmentState(ApartmentState.STA);
                staThreadText.Start();
                staThreadText.Join();

                if (res.Error != null) return res;

                // Perform Paste action
                if (method.Equals("SendKeys", StringComparison.OrdinalIgnoreCase)) {
                    SendKeys.SendWait("^{v}");
                } else {
                    SendPasteKeybdEvent();
                }

                Thread.Sleep(pasteDelayMs);

                if (submitEnter) {
                    if (method.Equals("SendKeys", StringComparison.OrdinalIgnoreCase)) {
                        SendKeys.SendWait("{ENTER}");
                    } else {
                        SendEnterKeybdEvent();
                    }
                }
            }

            res.Success = true;
            res.HWND = "0x" + bestHwnd.ToInt64().ToString("X");
            res.PID = bestPid;
            res.Title = bestTitle;
        } catch (Exception ex) {
            res.Error = ex.Message;
        }

        return res;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'Win32ClipboardInjector').Type) {
    Add-Type -TypeDefinition $code -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll"
}

$result = [Win32ClipboardInjector]::InjectText($Text, $TargetTitle, $ProcessName, $FocusDelayMs, $PasteDelayMs, $SendEnter, $FocusShortcut, $Method, $NewChat)
$json = $result | ConvertTo-Json -Compress
Write-Output $json
