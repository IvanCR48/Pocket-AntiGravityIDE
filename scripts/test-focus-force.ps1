Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public class FocusTester {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindolwAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowTextLength(IntPtr hWnd);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public const int SW_RESTORE = 9;

    public static string TestFocus(string targetProcName) {
        StringBuilder log = new StringBuilder();

        IntPtr fgHwnd = GetForegroundWindow();
        uint fgPid = 0;
        uint fgThread = GetWindowThreadProcessId(fgHwnd, out fgPid);
        log.AppendLine("Foreground HWND: 0x" + fgHwnd.ToInt64().ToString("X") + " (PID: " + fgPid + ", Thread: " + fgThread + ")");

        IntPtr targetHwnd = IntPtr.Zero;
        uint targetPid = 0;
        uint targetThread = 0;
        string targetTitle = "";

        HashSet<uint> targetPids = new HashSet<uint>();
        foreach (Process p in Process.GetProcesses()) {
            if (p.ProcessName.IndexOf(targetProcName, StringComparison.OrdinalIgnoreCase) >= 0) {
                targetPids.Add((uint)p.Id);
            }
        }

        log.AppendLine("Found PIDs for '" + targetProcName + "': " + targetPids.Count);

        EnumWindows((hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            if (targetPids.Contains(pid)) {
                int len = GetWindowTextLength(hWnd);
                if (len > 0) {
                    StringBuilder sb = new StringBuilder(len + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    string t = sb.ToString();
                    if (IsWindowVisible(hWnd) || targetHwnd == IntPtr.Zero) {
                        targetHwnd = hWnd;
                        targetPid = pid;
                        uint dummyPid;
                        targetThread = GetWindowThreadProcessId(hWnd, out dummyPid);
                        targetTitle = t;
                        if (IsWindowVisible(hWnd)) return false;
                    }
                }
            }
            return true;
        }, IntPtr.Zero);

        if (targetHwnd == IntPtr.Zero) {
            log.AppendLine("EnumWindows did not find matching visible window for process '" + targetProcName + "'");
            return log.ToString();
        }

        log.AppendLine("Target HWND found: 0x" + targetHwnd.ToInt64().ToString("X") + " (PID: " + targetPid + ", Thread: " + targetThread + ", Title: '" + targetTitle + "')");

        uint curThread = GetCurrentThreadId();

        bool attFg = false;
        bool attTarget = false;
        if (fgThread != curThread && fgThread != 0) attFg = AttachThreadInput(curThread, fgThread, true);
        if (targetThread != curThread && targetThread != 0) attTarget = AttachThreadInput(curThread, targetThread, true);

        log.AppendLine("Attached Fg: " + attFg + ", Attached Target: " + attTarget);

        if (IsIconic(targetHwnd)) {
            ShowWindowAsync(targetHwnd, SW_RESTORE);
        }

        BringWindowToTop(targetHwnd);
        bool res1 = SetForegroundWindow(targetHwnd);
        log.AppendLine("SetForegroundWindow result: " + res1);

        if (attTarget) AttachThreadInput(curThread, targetThread, false);
        if (attFg) AttachThreadInput(curThread, fgThread, false);

        Thread.Sleep(500);

        IntPtr newFg = GetForegroundWindow();
        log.AppendLine("New Foreground HWND: 0x" + newFg.ToInt64().ToString("X"));
        log.AppendLine("Focus Switch Success: " + (newFg == targetHwnd));

        return log.ToString();
    }
}
"@

$res = [FocusTester]::TestFocus("Antigravity IDE")
Write-Host $res
