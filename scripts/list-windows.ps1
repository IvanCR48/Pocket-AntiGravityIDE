# list-windows.ps1 - Debug script to list all open visible windows with PID and Title
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WindowLister {
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public class WindowEntry {
        public string Handle;
        public uint PID;
        public string Process;
        public string Title;
    }

    public static List<WindowEntry> GetVisibleWindows() {
        List<WindowEntry> list = new List<WindowEntry>();
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                int length = GetWindowTextLength(hWnd);
                if (length > 0) {
                    StringBuilder sb = new StringBuilder(length + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    string title = sb.ToString();

                    uint pid = 0;
                    GetWindowThreadProcessId(hWnd, out pid);

                    string procName = "";
                    try {
                        Process p = Process.GetProcessById((int)pid);
                        if (p != null) procName = p.ProcessName;
                    } catch {}

                    list.Add(new WindowEntry {
                        Handle = "0x" + hWnd.ToInt64().ToString("X"),
                        PID = pid,
                        Process = procName,
                        Title = title
                    });
                }
            }
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

$list = [WindowLister]::GetVisibleWindows()
Write-Host ($list | ConvertTo-Json -Compress)
