# clipboard-injector.ps1 - Win32 Clipboard Injection & Smart Reset Focus Engine
param (
    [string]$TargetTitle = "Antigravity IDE",
    [string]$ProcessName = "Antigravity IDE",
    [string]$FocusShortcut = "Auto",
    [int]$FocusDelayMs = 500,
    [int]$PasteDelayMs = 250,
    [bool]$SubmitEnter = $true,
    [bool]$NewChat = $false,
    [string]$Method = "keybd_event"
)

$code = @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public class Win32ClipboardInjector {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

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

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    public const byte VK_CONTROL = 0x11;
    public const byte VK_SHIFT = 0x10;
    public const byte VK_ALT = 0x12;
    public const byte VK_V = 0x56;
    public const byte VK_L = 0x4C;
    public const byte VK_I = 0x49;
    public const byte VK_P = 0x50;
    public const byte VK_RETURN = 0x0D;

    public const uint KEYEVENTF_KEYUP = 0x0002;

    public class InjectResult {
        public bool Success;
        public uint PID;
        public string HWND;
        public string Title;
        public string ShortcutUsed;
        public string MethodUsed;
        public string Error;
    }

    public static void SendKeybd(byte vk, bool keyUp) {
        uint flags = keyUp ? KEYEVENTF_KEYUP : 0;
        keybd_event(vk, 0, flags, UIntPtr.Zero);
    }

    public static void SendCtrlL() {
        SendKeybd(VK_CONTROL, false);
        Thread.Sleep(30);
        SendKeybd(VK_L, false);
        Thread.Sleep(40);
        SendKeybd(VK_L, true);
        Thread.Sleep(30);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftL() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false);
        Thread.Sleep(30);
        SendKeybd(VK_L, false);
        Thread.Sleep(40);
        SendKeybd(VK_L, true);
        Thread.Sleep(30);
        SendKeybd(VK_SHIFT, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendPasteKeybdEvent() {
        SendKeybd(VK_CONTROL, false);
        Thread.Sleep(40);
        SendKeybd(VK_V, false);
        Thread.Sleep(40);
        SendKeybd(VK_V, true);
        Thread.Sleep(40);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendEnterKeybdEvent() {
        SendKeybd(VK_RETURN, false);
        Thread.Sleep(50);
        SendKeybd(VK_RETURN, true);
    }

    public static void FocusChatViaSmartResetSequence() {
        // 1. Send Ctrl+L (Closes/toggles focus away from any code editor or panel)
        SendCtrlL();
        Thread.Sleep(300);

        // 2. Send Ctrl+L again (Re-opens & forces focus directly into Chat input bar)
        SendCtrlL();
        Thread.Sleep(550); // Robust 550ms delay to allow Electron panel animation & focus lock
    }

    public static InjectResult Inject(string targetTitle, string targetProcName, string focusShortcut, int focusDelayMs, int pasteDelayMs, bool submitEnter, bool newChat) {
        InjectResult res = new InjectResult {
            Success = false,
            PID = 0,
            HWND = "0x0",
            Title = "",
            ShortcutUsed = focusShortcut,
            MethodUsed = "keybd_event",
            Error = null
        };

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
                    p.Refresh();
                    if (p.MainWindowHandle != IntPtr.Zero) {
                        bestHwnd = p.MainWindowHandle;
                        bestTitle = p.MainWindowTitle;
                        bestPid = (uint)p.Id;
                    }
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
                pName.IndexOf("msedge", StringComparison.OrdinalIgnoreCase) >= 0) return true;

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
            res.Error = "Antigravity IDE window not found.";
            return res;
        }

        // Restore & Bring Window to Top
        if (IsIconic(bestHwnd)) {
            ShowWindowAsync(bestHwnd, SW_RESTORE);
        } else {
            ShowWindowAsync(bestHwnd, SW_SHOW);
        }

        uint dummyPid;
        uint targetThreadId = GetWindowThreadProcessId(bestHwnd, out dummyPid);
        uint currentThreadId = GetCurrentThreadId();

        bool attached = false;
        if (targetThreadId != currentThreadId && targetThreadId != 0) {
            attached = AttachThreadInput(currentThreadId, targetThreadId, true);
        }

        BringWindowToTop(bestHwnd);
        SetForegroundWindow(bestHwnd);

        if (attached) {
            AttachThreadInput(currentThreadId, targetThreadId, false);
        }

        Thread.Sleep(150);

        if (newChat) {
            SendCtrlShiftL();
            Thread.Sleep(400);
        }

        // Execute Guaranteed Smart Reset Focus Sequence on EVERY prompt
        FocusChatViaSmartResetSequence();

        // Paste text from clipboard
        SendPasteKeybdEvent();
        Thread.Sleep(pasteDelayMs);

        // Submit with Enter
        if (submitEnter) {
            SendEnterKeybdEvent();
        }

        res.Success = true;
        res.PID = bestPid;
        res.HWND = "0x" + bestHwnd.ToInt64().ToString("X");
        res.Title = bestTitle;
        return res;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'Win32ClipboardInjector').Type) {
    Add-Type -TypeDefinition $code
}

$result = [Win32ClipboardInjector]::Inject($TargetTitle, $ProcessName, $FocusShortcut, $FocusDelayMs, $PasteDelayMs, $SubmitEnter, $NewChat)
$json = $result | ConvertTo-Json -Compress
Write-Output $json
