Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WinInspector {
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    public class WinInfo {
        public string HWND;
        public uint PID;
        public string Process;
        public string Title;
        public bool Visible;
    }

    public static List<WinInfo> GetAllWindows() {
        List<WinInfo> list = new List<WinInfo>();
        EnumWindows((hWnd, lParam) => {
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            StringBuilder sb = new StringBuilder(512);
            GetWindowText(hWnd, sb, 512);
            string title = sb.ToString();

            string pName = "";
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p != null) pName = p.ProcessName;
            } catch {}

            list.Add(new WinInfo {
                HWND = "0x" + hWnd.ToInt64().ToString("X"),
                PID = pid,
                Process = pName,
                Title = title,
                Visible = IsWindowVisible(hWnd)
            });
            return true;
        }, IntPtr.Zero);
        return list;
    }
}
"@

$list = [WinInspector]::GetAllWindows()
$json = $list | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText("c:\Users\Danie\OneDrive\Desktop\Estudio Y Proyectos\Functionality\scripts\all_windows.json", $json)
Write-Host "Wrote $($list.Count) windows to all_windows.json"
