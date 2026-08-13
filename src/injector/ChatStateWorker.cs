using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Automation;
using System.Threading;

public class ChatStateWorker {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public class StateResult {
        public bool WindowFound { get; set; }
        public bool IsWindowForeground { get; set; }
        public bool IsChatOpen { get; set; }
        public bool IsChatFocused { get; set; }
        public string StateString { get; set; }
    }

    public static StateResult CheckState(string targetTitle, string targetProcName) {
        StateResult res = new StateResult {
            WindowFound = false,
            IsWindowForeground = false,
            IsChatOpen = false,
            IsChatFocused = false,
            StateString = "CLOSED"
        };

        try {
            IntPtr bestHwnd = IntPtr.Zero;
            HashSet<uint> targetPids = new HashSet<uint>();

            Process[] procs = Process.GetProcesses();
            foreach (Process p in procs) {
                try {
                    if (p.ProcessName.IndexOf(targetProcName, StringComparison.OrdinalIgnoreCase) >= 0 ||
                        p.ProcessName.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0) {
                        targetPids.Add((uint)p.Id);
                    }
                } catch {}
            }

            EnumWindows((hWnd, lParam) => {
                if (!IsWindowVisible(hWnd)) return true;

                uint pid = 0;
                GetWindowThreadProcessId(hWnd, out pid);

                StringBuilder sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);
                string className = sbClass.ToString();

                // Target main Electron Chrome_WidgetWin_1 window specifically
                if (className.Equals("Chrome_WidgetWin_1", StringComparison.OrdinalIgnoreCase) || targetPids.Contains(pid)) {
                    StringBuilder sbTitle = new StringBuilder(256);
                    GetWindowText(hWnd, sbTitle, 256);
                    string title = sbTitle.ToString();

                    if (!string.IsNullOrEmpty(title) && (title.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 || targetPids.Contains(pid))) {
                        bestHwnd = hWnd;
                        return false;
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (bestHwnd == IntPtr.Zero) {
                res.StateString = "CLOSED";
                return res;
            }

            res.WindowFound = true;
            IntPtr fgHwnd = GetForegroundWindow();
            res.IsWindowForeground = (fgHwnd == bestHwnd);

            AutomationElement root = AutomationElement.FromHandle(bestHwnd);
            if (root != null) {
                // Pass 1: Warm-up Chromium UIA renderer tree
                var condition = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
                AutomationElementCollection edits = root.FindAll(TreeScope.Descendants, condition);

                // Pass 2: Read actual elements after Chromium renderer wakes up
                if (edits.Count == 0) {
                    Thread.Sleep(50);
                    edits = root.FindAll(TreeScope.Descendants, condition);
                }

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
                                res.IsChatOpen = true;
                                if (hasFocus) {
                                    res.IsChatFocused = true;
                                }
                            }
                        }
                    } catch {}
                }
            }

            if (res.IsChatFocused) {
                res.StateString = "FOCUSED";
            } else if (res.IsChatOpen) {
                res.StateString = "OPENED";
            } else {
                res.StateString = "CLOSED";
            }
        } catch (Exception ex) {
            res.StateString = "ERROR: " + ex.Message;
        }

        return res;
    }

    public static void Main(string[] args) {
        Console.OutputEncoding = Encoding.UTF8;
        string targetTitle = args.Length > 0 ? args[0] : "Antigravity IDE";
        string targetProc = args.Length > 1 ? args[1] : "Antigravity IDE";

        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.Trim();
            if (line.Equals("QUIT", StringComparison.OrdinalIgnoreCase) || line.Equals("EXIT", StringComparison.OrdinalIgnoreCase)) {
                break;
            }

            StateResult res = CheckState(targetTitle, targetProc);
            string json = String.Format(
                "{{\"windowFound\":{0},\"isWindowForeground\":{1},\"isChatOpen\":{2},\"isChatFocused\":{3},\"stateString\":\"{4}\"}}",
                res.WindowFound ? "true" : "false",
                res.IsWindowForeground ? "true" : "false",
                res.IsChatOpen ? "true" : "false",
                res.IsChatFocused ? "true" : "false",
                res.StateString
            );
            Console.WriteLine(json);
        }
    }
}
