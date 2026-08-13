Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class Win32 {
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
}
"@

$foundWindows = @()

$proc = [Win32+EnumWindowsProc]{
    param($hWnd, $lParam)
    $sbTitle = New-Object System.Text.StringBuilder 512
    [Win32]::GetWindowText($hWnd, $sbTitle, 512) | Out-Null
    $title = $sbTitle.ToString()
    
    if ($title -ne "") {
        $pidOut = 0
        [Win32]::GetWindowThreadProcessId($hWnd, [ref]$pidOut) | Out-Null
        $sbClass = New-Object System.Text.StringBuilder 256
        [Win32]::GetClassName($hWnd, $sbClass, 256) | Out-Null
        $vis = [Win32]::IsWindowVisible($hWnd)
        
        $pName = ""
        try {
            $p = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
            if ($p) { $pName = $p.ProcessName }
        } catch {}

        $script:foundWindows += [PSCustomObject]@{
            HWND = "0x{0:X}" -f $hWnd.ToInt64()
            PID = $pidOut
            Process = $pName
            Title = $title
            Class = $sbClass.ToString()
            Visible = $vis
        }
    }
    return $true
}

$script:foundWindows = @()
[Win32]::EnumWindows($proc, [IntPtr]::Zero) | Out-Null

$script:foundWindows | ConvertTo-Json | Out-File -Encoding utf8 "c:\Users\Danie\OneDrive\Desktop\Estudio Y Proyectos\Functionality\scripts\windows.json"
Write-Host "Saved $($script:foundWindows.Count) windows to windows.json"
