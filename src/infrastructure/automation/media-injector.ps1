# media-injector.ps1 - Image and File Clipboard Injection for Antigravity IDE
param (
    [string]$ImagePath = "",
    [string]$FilePath = "",
    [string]$Text = "",
    [string]$TargetTitle = "Antigravity IDE",
    [string]$ProcessName = "Antigravity IDE",
    [int]$FocusDelayMs = 500,
    [int]$PasteDelayMs = 300,
    [switch]$SendEnter = $true,
    [string]$Method = "keybd_event"
)

$code = @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.IO;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public class Win32MediaInjector {
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

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

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

    public const byte VK_ESCAPE = 0x1B;
    public const byte VK_SHIFT = 0x10;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_1 = 0x31;
    public const byte VK_L = 0x4C;
    public const byte VK_P = 0x50;
    public const byte VK_V = 0x56;
    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const int ASFW_ANY = -1;
    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    public class MediaInjectResult {
        public bool Success;
        public string HWND;
        public uint PID;
        public string Title;
        public string ImagePath;
        public string FilePath;
        public string Text;
        public string Error;
    }

    public static void SendKeybd(byte vk, bool keyUp) {
        uint flags = keyUp ? KEYEVENTF_KEYUP : 0;
        keybd_event(vk, 0, flags, UIntPtr.Zero);
    }

    public static void SendCtrl1() {
        SendKeybd(VK_CONTROL, false);
        Thread.Sleep(20);
        SendKeybd(VK_1, false);
        Thread.Sleep(20);
        SendKeybd(VK_1, true);
        Thread.Sleep(20);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlL() {
        SendKeybd(VK_CONTROL, false);
        Thread.Sleep(20);
        SendKeybd(VK_L, false);
        Thread.Sleep(20);
        SendKeybd(VK_L, true);
        Thread.Sleep(20);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftP() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false);
        Thread.Sleep(30);
        SendKeybd(VK_P, false);
        Thread.Sleep(30);
        SendKeybd(VK_P, true);
        Thread.Sleep(30);
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

    public static void FocusChatViaCommandPalette() {
        // 0. Send Ctrl+1 first to safely move focus out of Terminal/editor
        SendCtrl1();
        Thread.Sleep(150);

        // 1. Command Palette "Agent: Focus on Agent View" opens & activates the Agent panel
        SendCtrlShiftP();
        Thread.Sleep(150);
        Thread staThread = new Thread(() => {
            try {
                Clipboard.SetText("Agent: Focus on Agent View");
            } catch {}
        });
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();
        staThread.Join();

        SendPasteKeybdEvent();
        Thread.Sleep(100);
        SendEnterKeybdEvent();
        Thread.Sleep(200);

        // 2. Ctrl+L locks focus directly into the chat input box
        SendCtrlL();
        Thread.Sleep(250);
    }

    public static MediaInjectResult InjectMedia(string imagePath, string filePath, string text, string targetTitle, string targetProcName, int focusDelayMs, int pasteDelayMs, bool submitEnter) {
        MediaInjectResult res = new MediaInjectResult {
            Success = false,
            HWND = "0x0",
            PID = 0,
            Title = "",
            ImagePath = imagePath,
            FilePath = filePath,
            Text = text,
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

                StringBuilder sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);
                string className = sbClass.ToString();

                bool isElectronWidget = className.IndexOf("Chrome_WidgetWin_1", StringComparison.OrdinalIgnoreCase) >= 0;
                bool titleMatch = !string.IsNullOrEmpty(targetTitle) &&
                                  (title.IndexOf(targetTitle, StringComparison.OrdinalIgnoreCase) >= 0 ||
                                   title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0);

                if ((isTargetPid || titleMatch) && isElectronWidget) {
                    if (IsWindowVisible(hWnd) || bestHwnd == IntPtr.Zero) {
                        bestHwnd = hWnd;
                        bestTitle = title;
                        bestPid = pid;
                        if (IsWindowVisible(hWnd) && titleMatch) {
                            return false;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (bestHwnd == IntPtr.Zero) {
                res.Error = "Target window not found.";
                return res;
            }

            // Clean title string to remove control characters/newlines
            if (!string.IsNullOrEmpty(bestTitle)) {
                bestTitle = System.Text.RegularExpressions.Regex.Replace(bestTitle, @"[\r\n\t]+", " ");
            }

            // Restore & Focus Main Window
            IntPtr fgHwnd = GetForegroundWindow();
            uint dummy;
            uint fgThread = GetWindowThreadProcessId(fgHwnd, out dummy);
            uint targetThread = GetWindowThreadProcessId(bestHwnd, out dummy);
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

            if (IsIconic(bestHwnd)) {
                OpenIcon(bestHwnd);
                ShowWindowAsync(bestHwnd, SW_RESTORE);
            } else {
                ShowWindowAsync(bestHwnd, SW_SHOW);
            }

            SetWindowPos(bestHwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_FLAGS);
            SetWindowPos(bestHwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_FLAGS);

            BringWindowToTop(bestHwnd);
            SetForegroundWindow(bestHwnd);
            SwitchToThisWindow(bestHwnd, true);

            if (attachedTarget) AttachThreadInput(curThread, targetThread, false);
            if (attachedFg) AttachThreadInput(curThread, fgThread, false);

            Thread.Sleep(250);

            FocusChatViaCommandPalette();

            Thread.Sleep(focusDelayMs);

            // Step 1: Inject Image if provided
            if (!string.IsNullOrEmpty(imagePath) && File.Exists(imagePath)) {
                Thread staImg = new Thread(() => {
                    try {
                        using (Image img = Image.FromFile(imagePath)) {
                            Clipboard.SetImage(img);
                        }
                    } catch (Exception ex) {
                        res.Error = "Image clipboard error: " + ex.Message;
                    }
                });
                staImg.SetApartmentState(ApartmentState.STA);
                staImg.Start();
                staImg.Join();

                if (res.Error != null) return res;

                SendPasteKeybdEvent();
                Thread.Sleep(pasteDelayMs + 200);
            }

            // Step 2: Inject File reference if provided
            if (!string.IsNullOrEmpty(filePath) && File.Exists(filePath)) {
                Thread staFile = new Thread(() => {
                    try {
                        StringCollection files = new StringCollection();
                        files.Add(Path.GetFullPath(filePath));
                        Clipboard.SetFileDropList(files);
                    } catch (Exception ex) {
                        res.Error = "File drop list error: " + ex.Message;
                    }
                });
                staFile.SetApartmentState(ApartmentState.STA);
                staFile.Start();
                staFile.Join();

                if (res.Error != null) return res;

                SendPasteKeybdEvent();
                Thread.Sleep(pasteDelayMs + 150);
            }

            // Step 3: Inject Text prompt if provided
            if (!string.IsNullOrEmpty(text)) {
                Thread staText = new Thread(() => {
                    try {
                        Clipboard.SetText(text);
                    } catch (Exception ex) {
                        res.Error = "Text clipboard error: " + ex.Message;
                    }
                });
                staText.SetApartmentState(ApartmentState.STA);
                staText.Start();
                staText.Join();

                if (res.Error != null) return res;

                SendPasteKeybdEvent();
                Thread.Sleep(pasteDelayMs);
            }

            // Step 4: Submit via Enter if requested
            if (submitEnter) {
                SendEnterKeybdEvent();
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

if (-not ([System.Management.Automation.PSTypeName]'Win32MediaInjector').Type) {
    Add-Type -TypeDefinition $code -ReferencedAssemblies "System.Windows.Forms.dll", "System.Drawing.dll"
}

$result = [Win32MediaInjector]::InjectMedia($ImagePath, $FilePath, $Text, $TargetTitle, $ProcessName, $FocusDelayMs, $PasteDelayMs, $SendEnter)
$json = $result | ConvertTo-Json -Compress
Write-Output $json
