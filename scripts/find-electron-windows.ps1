Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class ElectronFinder {
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public class WindowResult {
        public string HWND;
        public uint PID;
        public string Process;
        public string Title;
        public string ClassName;
        public bool Visible;
    }

    public static List<WindowResult> FindAllForProcess(string procPattern) {
        HashSet<uint> pids = new HashSet<uint>();
        foreach (Process p in Process.GetProcesses()) {
            if (p.ProcessName.IndexOf(procPattern, StringComparison.OrdinalIgnoreCase) >= 0) {
                pids.Add((uint)p.Id);
            }
        }

        List<WindowResult> list = new List<WindowResult>();
        EnumWindows((hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            if (pids.Contains(pid)) {
                int len = GetWindowTextLength(hWnd);
                StringBuilder titleSb = new StringBuilder(len + 1);
                if (len > 0) GetWindowText(hWnd, titleSb, titleSb.Capacity);

                StringBuilder classSb = new StringBuilder(256);
                GetClassName(hWnd, classSb, classSb.Capacity);

                list.Add(new WindowResult {
                    HWND = "0x" + hWnd.ToInt64().ToString("X"),
                    PID = pid,
                    Process = procPattern,
                    Title = titleSb.ToString(),
                    ClassName = classSb.ToString(),
                    Visible = IsWindowVisible(hWnd)
                });
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

$list = [ElectronFinder]::FindAllForProcess("Antigravity IDE")
$json = $list | ConvertTo-Json -Compress
Write-Output $json
