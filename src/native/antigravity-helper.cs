using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Windows.Automation;
using System.Threading;

public class AntigravityNativeHelper {
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

    public const byte VK_MENU = 0x12;
    public const byte VK_SHIFT = 0x10;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_I = 0x49;
    public const byte VK_L = 0x4C;
    public const byte VK_N = 0x4E;
    public const byte VK_P = 0x50;
    public const byte VK_V = 0x56;
    public const byte VK_RETURN = 0x0D;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const int ASFW_ANY = -1;
    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    public static IntPtr FindTargetHwnd(string targetProcName, out uint outPid) {
        IntPtr bestHwnd = IntPtr.Zero;
        uint bestPid = 0;

        HashSet<uint> targetPids = new HashSet<uint>();
        foreach (Process p in Process.GetProcesses()) {
            try {
                if (p.ProcessName.IndexOf(targetProcName, StringComparison.OrdinalIgnoreCase) >= 0) {
                    targetPids.Add((uint)p.Id);
                    p.Refresh();
                    if (p.MainWindowHandle != IntPtr.Zero) {
                        bestHwnd = p.MainWindowHandle;
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
            bool titleMatch = title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
                              title.IndexOf("Functionality", StringComparison.OrdinalIgnoreCase) >= 0;

            if (isTargetPid && (isElectronWidget || titleMatch || !string.IsNullOrEmpty(title))) {
                if (IsWindowVisible(hWnd) || bestHwnd == IntPtr.Zero) {
                    bestHwnd = hWnd;
                    bestPid = pid;
                    if (IsWindowVisible(hWnd) && titleMatch) {
                        return false;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);

        outPid = bestPid;
        return bestHwnd;
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
        SendKeybd(VK_CONTROL, false); Thread.Sleep(20);
        SendKeybd(VK_L, false); Thread.Sleep(20);
        SendKeybd(VK_L, true); Thread.Sleep(20);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftL() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false); Thread.Sleep(20);
        SendKeybd(VK_L, false); Thread.Sleep(20);
        SendKeybd(VK_L, true); Thread.Sleep(20);
        SendKeybd(VK_SHIFT, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendCtrlShiftP() {
        SendKeybd(VK_CONTROL, false);
        SendKeybd(VK_SHIFT, false); Thread.Sleep(20);
        SendKeybd(VK_P, false); Thread.Sleep(20);
        SendKeybd(VK_P, true); Thread.Sleep(20);
        SendKeybd(VK_SHIFT, true);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendPasteKeybdEvent() {
        SendKeybd(VK_CONTROL, false); Thread.Sleep(30);
        SendKeybd(VK_V, false); Thread.Sleep(30);
        SendKeybd(VK_V, true); Thread.Sleep(30);
        SendKeybd(VK_CONTROL, true);
    }

    public static void SendEnterKeybdEvent() {
        SendKeybd(VK_RETURN, false); Thread.Sleep(30);
        SendKeybd(VK_RETURN, true);
    }

    public static void FocusChatViaSmartResetSequence() {
        SendCtrlL();
        Thread.Sleep(150);
        SendCtrlL();
        Thread.Sleep(200);

        SendCtrlShiftP();
        Thread.Sleep(120);
        Thread staThread = new Thread(() => {
            try {
                Clipboard.SetText("Code with Agent");
            } catch {}
        });
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();
        staThread.Join();

        SendPasteKeybdEvent();
        Thread.Sleep(100);
        SendEnterKeybdEvent();
        Thread.Sleep(150);
    }

    public static void NewChatSequence() {
        SendCtrlShiftL();
        Thread.Sleep(120);

        SendCtrlShiftP();
        Thread.Sleep(120);
        Thread staThread = new Thread(() => {
            try {
                Clipboard.SetText("New Conversation");
            } catch {}
        });
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();
        staThread.Join();

        SendPasteKeybdEvent();
        Thread.Sleep(100);
        SendEnterKeybdEvent();
        Thread.Sleep(150);
    }

    public static string DetectState(IntPtr targetHwnd) {
        if (targetHwnd == IntPtr.Zero) return "{\"windowFound\":false,\"isWindowForeground\":false,\"isChatOpen\":false,\"isChatFocused\":false,\"stateString\":\"CLOSED\"}";

        IntPtr fgHwnd = GetForegroundWindow();
        bool isFg = (fgHwnd == targetHwnd);
        bool isOpen = false;
        bool isFocused = false;

        AutomationElement root = AutomationElement.FromHandle(targetHwnd);
        if (root != null) {
            // 1st Pass: Wake up Chromium Accessibility Renderer Tree
            try {
                var firstPass = root.FindFirst(TreeScope.Children, Condition.TrueCondition);
            } catch {}

            // 2nd Pass: Scan real element tree
            var condition = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
            AutomationElementCollection edits = root.FindAll(TreeScope.Descendants, condition);

            foreach (AutomationElement edit in edits) {
                try {
                    string name = edit.Current.Name ?? "";
                    string aid = edit.Current.AutomationId ?? "";
                    string classname = edit.Current.ClassName ?? "";
                    bool isOffscreen = edit.Current.IsOffscreen;
                    bool hasFocus = edit.Current.HasKeyboardFocus;

                    bool isActivityBar = aid.IndexOf("activitybar", StringComparison.OrdinalIgnoreCase) >= 0 || name.IndexOf("Activity Bar", StringComparison.OrdinalIgnoreCase) >= 0;
                    bool isTerminal = name.IndexOf("Terminal", StringComparison.OrdinalIgnoreCase) >= 0 || aid.IndexOf("terminal", StringComparison.OrdinalIgnoreCase) >= 0 || classname.IndexOf("xterm", StringComparison.OrdinalIgnoreCase) >= 0;
                    bool isCodeFile = name.EndsWith(".js") || name.EndsWith(".html") || name.EndsWith(".css") || name.EndsWith(".json") || name.EndsWith(".py") || name.EndsWith(".md");

                    if (!isActivityBar && !isTerminal && !isCodeFile) {
                        if (!isOffscreen) {
                            isOpen = true;
                            if (hasFocus) {
                                isFocused = true;
                            }
                        }
                    }
                } catch {}
            }
        }

        string state = isFocused ? "FOCUSED" : (isOpen ? "OPENED" : "CLOSED");
        return string.Format("{{\"windowFound\":true,\"isWindowForeground\":{0},\"isChatOpen\":{1},\"isChatFocused\":{2},\"stateString\":\"{3}\"}}",
            isFg.ToString().ToLower(), isOpen.ToString().ToLower(), isFocused.ToString().ToLower(), state);
    }

    [STAThread]
    public static void Main(string[] args) {
        if (args.Length == 0) {
            Console.WriteLine("Usage: antigravity-helper.exe [state|inject|newchat] [options]");
            return;
        }

        string mode = args[0].ToLower();
        uint pid = 0;
        IntPtr hwnd = FindTargetHwnd("Antigravity", out pid);

        if (mode == "state") {
            string json = DetectState(hwnd);
            Console.WriteLine(json);
        } else if (mode == "newchat") {
            if (hwnd == IntPtr.Zero) {
                Console.WriteLine("{\"success\":false,\"error\":\"Target window not found\"}");
                return;
            }
            BringToTopZOrder(hwnd);
            Thread.Sleep(300);
            NewChatSequence();
            Console.WriteLine("{\"success\":true,\"mode\":\"newchat\"}");
        } else if (mode == "inject") {
            string text = "";
            for (int i = 1; i < args.Length; i++) {
                if (args[i] == "--text" && i + 1 < args.Length) {
                    text = args[i + 1];
                    break;
                }
            }

            if (hwnd == IntPtr.Zero) {
                Console.WriteLine("{\"success\":false,\"error\":\"Target window not found\"}");
                return;
            }

            BringToTopZOrder(hwnd);
            Thread.Sleep(300);
            FocusChatViaSmartResetSequence();

            if (!string.IsNullOrEmpty(text)) {
                Clipboard.SetText(text);
                SendPasteKeybdEvent();
                Thread.Sleep(200);
                SendEnterKeybdEvent();
            }

            Console.WriteLine("{\"success\":true,\"hwnd\":\"0x" + hwnd.ToInt64().ToString("X") + "\"}");
        } else {
            Console.WriteLine("{\"error\":\"Unknown mode\"}");
        }
    }
}
