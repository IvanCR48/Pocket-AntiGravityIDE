Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class RealHwndFinder {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    public class WindowEntry {
        public string HWND;
        public uint PID;
        public string Process;
        public string Title;
        public string ClassName;
    }

    public static List<WindowEntry> FindAll() {
        List<WindowEntry> list = new List<WindowEntry>();
        IntPtr hWnd = IntPtr.Zero;
        do {
            hWnd = FindWindowEx(IntPtr.Zero, hWnd, null, null);
            if (hWnd != IntPtr.Zero) {
                uint pid = 0;
                GetWindowThreadProcessId(hWnd, out pid);
                StringBuilder sbTitle = new StringBuilder(512);
                GetWindowText(hWnd, sbTitle, 512);
                StringBuilder sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);

                string pName = "";
                try {
                    Process p = Process.GetProcessById((int)pid);
                    if (p != null) pName = p.ProcessName;
                } catch {}

                if (pName.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    sbTitle.ToString().IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    sbTitle.ToString().IndexOf("Functionality", StringComparison.OrdinalIgnoreCase) >= 0) {
                    list.Add(new WindowEntry {
                        HWND = "0x" + hWnd.ToInt64().ToString("X"),
                        PID = pid,
                        Process = pName,
                        Title = sbTitle.ToString(),
                        ClassName = sbClass.ToString()
                    });
                }
            }
        } while (hWnd != IntPtr.Zero);
        return list;
    }
}
"@

$res = [RealHwndFinder]::FindAll()
$json = $res | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText("c:\Users\Danie\OneDrive\Desktop\Estudio Y Proyectos\Functionality\scripts\real_hwnds.json", $json)
Write-Host "Found $($res.Count) matching windows."
