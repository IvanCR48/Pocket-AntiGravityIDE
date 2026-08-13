const { execSync } = require('child_process');

const ps = `
$code = @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class WinClassFinder {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public class WinItem {
        public string HWND;
        public uint PID;
        public string Process;
        public string Title;
        public bool Visible;
    }

    public static List<WinItem> FindByClass(string className) {
        List<WinItem> list = new List<WinItem>();
        IntPtr current = IntPtr.Zero;
        do {
            current = FindWindowEx(IntPtr.Zero, current, className, null);
            if (current != IntPtr.Zero) {
                uint pid = 0;
                GetWindowThreadProcessId(current, out pid);
                StringBuilder sb = new StringBuilder(512);
                GetWindowText(current, sb, 512);
                string procName = "";
                try {
                    Process p = Process.GetProcessById((int)pid);
                    if (p != null) procName = p.ProcessName;
                } catch {}

                list.Add(new WinItem {
                    HWND = "0x" + current.ToInt64().ToString("X"),
                    PID = pid,
                    Process = procName,
                    Title = sb.ToString(),
                    Visible = IsWindowVisible(current)
                });
            }
        } while (current != IntPtr.Zero);
        return list;
    }
}
"@

Add-Type -TypeDefinition $code
[WinClassFinder]::FindByClass("Chrome_WidgetWin_1") | ConvertTo-Json -Compress
`;

const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/\n/g, ' ')}"`;

try {
  const out = execSync(command, { encoding: 'utf8' });
  console.log("Chrome_WidgetWin_1 Windows:");
  console.log(out);
} catch (e) {
  console.error("Error:", e.message);
}
