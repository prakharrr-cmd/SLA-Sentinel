$path = "C:\Users\praxh\.gemini\antigravity\scratch\ops-intelligence-engine\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# Core color replacements from user's palette:
# Primary brand dark: #132E35
# Deepest base: #0D1F23
# Secondary accent: #2D4A53
# Muted steel: #69818D
# Light tint: #AFB3B7
# Neutral slate: #5A636A

$content = $content.Replace('#134E39', '#132E35')
$content = $content.Replace('#0E3A2B', '#0D1F23')
$content = $content.Replace('bg-emerald-400', 'bg-[#2D4A53]')
$content = $content.Replace('bg-[#0D1F23] text-emerald-200', 'bg-[#0D1F23] text-[#AFB3B7]')
$content = $content.Replace('bg-emerald-50 text-[#132E35] border border-emerald-200', 'bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30')
$content = $content.Replace('hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300', 'hover:bg-slate-100 border border-slate-200 hover:border-[#2D4A53]')
$content = $content.Replace('bg-emerald-100 text-[#132E35]', 'bg-[#2D4A53]/15 text-[#132E35]')
$content = $content.Replace('text-emerald-600 font-mono', 'text-[#2D4A53] font-mono font-medium')
$content = $content.Replace('text-emerald-100', 'text-[#AFB3B7]')
$content = $content.Replace('text-emerald-200', 'text-[#AFB3B7]')
$content = $content.Replace('bg-emerald-900/60 text-emerald-300 border border-emerald-700/50', 'bg-[#0D1F23] text-[#AFB3B7] border border-[#2D4A53]')
$content = $content.Replace('border-emerald-800/60 text-[10px] space-y-1.5 text-emerald-100', 'border-[#2D4A53]/60 text-[10px] space-y-1.5 text-[#AFB3B7]')
$content = $content.Replace('text-emerald-300 font-mono text-center bg-emerald-950/60 py-1.5 px-2 rounded-xl border border-emerald-800/50', 'text-[#AFB3B7] font-mono text-center bg-[#0D1F23]/80 py-1.5 px-2 rounded-xl border border-[#2D4A53]/50')
$content = $content.Replace('rgba(34,197,94,.18)', 'rgba(105,129,141,.25)')
$content = $content.Replace('rgba(20,83,45,.45)', 'rgba(13,31,35,.60)')

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output "Successfully updated index.html colors!"
