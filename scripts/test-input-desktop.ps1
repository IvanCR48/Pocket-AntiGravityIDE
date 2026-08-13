Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class DesktopHelper {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public const uint DESKTOP_ALL_ACCESS = 0x01FF;

    public class WindowEntry {
        public string HWND;
        public uint PID;
        public string Process;
        public string Title;
        public string ClassName;
    }

    public static List<WindowEntry> GetInputDesktopWindows() {
        List<WindowEntry> list = new List<WindowEntry>();

        IntPtr hInputDesktop = OpenInputDesktop(0, false, DESKTOP_ALL_ACCESS);
        if (hInputDesktop != IntPtr.Zero) {
            SetThreadDesktop(hInputDesktop);
        }

        IntPtr hWnd = IntPtr.Zero;
        int count = 0;
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

                list.Add(new WindowEntry {
                    HWND = "0x" + hWnd.ToInt64().ToString("X"),
                    PID = pid,
                    Process = pName,
                    Title = sbTitle.ToString(),
                    ClassName = sbClass.ToString()
                });
                count++;
            }
        } while (hWnd != IntPtr.Zero && count < 200);

        if (hInputDesktop != IntPtr.Zero) {
            CloseDesktop(hInputDesktop);
        }

        return list;
    }
}
"@

$res = [DesktopHelper]::GetInputDesktopWindows()
$json = $res | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText("c:\Users\Danie\OneDrive\Desktop\Estudio Y Proyectos\Functionality\scripts\input_desktop_windows.json", $json)
Write-Host "Found $($res.Count) windows on Input Desktop."
