$files = Get-ChildItem -Path "C:\Users\praxh\.gemini\antigravity\scratch\ops-intelligence-engine\src" -Recurse -Include *.jsx,*.js
$files += Get-Item -Path "C:\Users\praxh\.gemini\antigravity\brain\f7d3a089-e536-4da7-88b1-15e859c9f593\live_widget.html"

foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $c = $c.Replace('#134E39', '#132E35')
    $c = $c.Replace('#0E3A2B', '#0D1F23')
    $c = $c.Replace('text-[#134E39]', 'text-[#132E35]')
    $c = $c.Replace('focus:border-[#134E39]', 'focus:border-[#132E35]')
    $c = $c.Replace('bg-emerald-400', 'bg-[#2D4A53]')
    $c = $c.Replace('OpsPulse', 'SLA-Sentinel')
    [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
}

Write-Output "Updated all src files and live_widget.html with new palette"
