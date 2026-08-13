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

$pids = (Get-Process -Name "*Antigravity*").Id
Write-Host "Found PIDs count: $($pids.Count)"

$foundWindows = @()

$proc = [Win32+EnumWindowsProc]{
    param($hWnd, $lParam)
    $pidOut = 0
    [Win32]::GetWindowThreadProcessId($hWnd, [ref]$pidOut) | Out-Null
    if ($script:pids -contains $pidOut) {
        $sbTitle = New-Object System.Text.StringBuilder 512
        [Win32]::GetWindowText($hWnd, $sbTitle, 512) | Out-Null
        $sbClass = New-Object System.Text.StringBuilder 256
        [Win32]::GetClassName($hWnd, $sbClass, 256) | Out-Null
        $vis = [Win32]::IsWindowVisible($hWnd)
        
        $script:foundWindows += [PSCustomObject]@{
            HWND = "0x{0:X}" -f $hWnd.ToInt64()
            PID = $pidOut
            Title = $sbTitle.ToString()
            ClassName = $sbClass.ToString()
            Visible = $vis
        }
    }
    return $true
}

$script:pids = $pids
$script:foundWindows = @()
[Win32]::EnumWindows($proc, [IntPtr]::Zero) | Out-Null

Write-Host "Found windows count: $($script:foundWindows.Count)"
$script:foundWindows | Format-Table -AutoSize
