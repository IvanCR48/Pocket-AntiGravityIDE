# window-finder.ps1 - Win32 Window Finding & Focus Helper for Antigravity IDE
param (
    [string]$TargetTitle = "Antigravity IDE",
    [string]$ProcessName = "Antigravity IDE"
)

$code = @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class Win32WindowFinder {
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

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;

    public class FocusResult {
        public bool Success;
        public uint PID;
        public string HWND;
        public string Title;
        public string ProcessName;
        public string Error;
    }

    public static FocusResult FocusTargetWindow(string targetTitle, string targetProcName) {
        FocusResult res = new FocusResult {
            Success = false,
            PID = 0,
            HWND = "0x0",
            Title = "",
            ProcessName = "",
            Error = null
        };

        IntPtr bestHwnd = IntPtr.Zero;
        string bestTitle = "";
        uint bestPid = 0;
        string bestProc = "";

        // Collect PIDs for target process
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
                        bestProc = p.ProcessName;
                    }
                }
            } catch {}
        }

        // Search top-level windows via EnumWindows
        EnumWindows((hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);

            // Exclude Web Browsers from window matching
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
                return true; // Skip browser windows!
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
                    bestProc = pName;
                    if (IsWindowVisible(hWnd) && (titleMatch || !string.IsNullOrEmpty(title))) {
                        return false; // Found exact visible match
                    }
                }
            }
            return true;
        }, IntPtr.Zero);

        if (bestHwnd != IntPtr.Zero) {
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
            bool focused = SetForegroundWindow(bestHwnd);

            if (attached) {
                AttachThreadInput(currentThreadId, targetThreadId, false);
            }

            res.Success = focused || (bestHwnd != IntPtr.Zero);
            res.PID = bestPid;
            res.HWND = "0x" + bestHwnd.ToInt64().ToString("X");
            res.Title = bestTitle;
            res.ProcessName = bestProc;
        } else if (targetPids.Count > 0) {
            foreach (uint p in targetPids) {
                res.PID = p;
                break;
            }
            res.ProcessName = targetProcName;
            res.Success = false;
            res.Error = "Found process PID " + res.PID + ", but HWND is 0x0. Ensure running in interactive desktop session.";
        } else {
            res.Error = "No matching process or window found for process '" + targetProcName + "' or title '" + targetTitle + "'";
        }

        return res;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'Win32WindowFinder').Type) {
    Add-Type -TypeDefinition $code
}

$result = [Win32WindowFinder]::FocusTargetWindow($TargetTitle, $ProcessName)
$json = $result | ConvertTo-Json -Compress
Write-Output $json
