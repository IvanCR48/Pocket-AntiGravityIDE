# check-chat-state.ps1 - Calibrated 2-Pass UIA Chat Focus Detector
param (
    [string]$TargetTitle = "Antigravity IDE",
    [string]$ProcessName = "Antigravity IDE"
)

[void][System.Reflection.Assembly]::LoadWithPartialName("UIAutomationClient")
[void][System.Reflection.Assembly]::LoadWithPartialName("UIAutomationTypes")

$code = @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Automation;

public class ChatStateDetector {
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
        public bool WindowFound;
        public bool IsWindowForeground;
        public bool IsChatOpen;
        public bool IsChatFocused;
        public string StateString;
    }

    public static StateResult DetectState(string targetTitle, string targetProcName) {
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
                        if (IsWindowVisible(hWnd) && titleMatch) {
                            return false; // Found main editor window!
                        }
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
                // Pass 1: Wake up Chromium Renderer Accessibility Tree if dormant
                try {
                    var wakeUp = root.FindFirst(TreeScope.Children, Condition.TrueCondition);
                } catch {}

                // Pass 2: Query real edit controls
                var condition = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
                AutomationElementCollection edits = root.FindAll(TreeScope.Descendants, condition);

                foreach (AutomationElement edit in edits) {
                    try {
                        string name = edit.Current.Name ?? "";
                        string aid = edit.Current.AutomationId ?? "";
                        string classname = edit.Current.ClassName ?? "";
                        bool isOffscreen = edit.Current.IsOffscreen;
                        bool hasFocus = edit.Current.HasKeyboardFocus;

                        // Exclude ActivityBar, Terminal (xterm), and Monaco Code Files
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
}
"@

if (-not ([System.Management.Automation.PSTypeName]'ChatStateDetector').Type) {
    Add-Type -TypeDefinition $code -ReferencedAssemblies "UIAutomationClient", "UIAutomationTypes"
}

$result = [ChatStateDetector]::DetectState($TargetTitle, $ProcessName)
$json = $result | ConvertTo-Json -Compress
Write-Output $json
