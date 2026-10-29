$path = 'C:\Users\praxh\.gemini\antigravity\scratch\ops-intelligence-engine\index.html'
$content = [System.IO.File]::ReadAllText($path)

# ─────────────────────────────────────────────
# FIX 1: Remove stale "+ Assign Ticket" button from Dashboard header (lines 1067-1073)
# ─────────────────────────────────────────────
$old1 = '                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>+</span>
                  <span>Assign Ticket</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}'

$new1 = '                <button
                  onClick={handleOpenAutoOptimizer}'

if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    Write-Host "FIX 1 DONE: Removed Assign Ticket button from Dashboard header"
} else {
    Write-Host "FIX 1 FAILED: Pattern not found for Dashboard Assign Ticket button"
}

# ─────────────────────────────────────────────
# FIX 2: Remove stale "+ Assign Ticket" button from Tasks & Queue header (lines 1343-1349)
# ─────────────────────────────────────────────
$old2 = '                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>+</span>
                  <span>Assign Ticket</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}'

$new2 = '                <button
                  onClick={handleOpenAutoOptimizer}'

if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    Write-Host "FIX 2 DONE: Removed Assign Ticket button from Tasks header"
} else {
    Write-Host "FIX 2 FAILED: Pattern not found for Tasks Assign Ticket button"
}

# ─────────────────────────────────────────────
# Save
# ─────────────────────────────────────────────
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "File saved successfully."

# ─────────────────────────────────────────────
# Verify
# ─────────────────────────────────────────────
$verify = [System.IO.File]::ReadAllText($path)
$assignCount = ([regex]::Matches($verify, 'Assign Ticket')).Count
Write-Host "Remaining 'Assign Ticket' occurrences (should be 1 - inside old modal form): $assignCount"

# Count Reset Baseline occurrences
$resetCount = ([regex]::Matches($verify, 'Reset Baseline')).Count
Write-Host "Remaining 'Reset Baseline' occurrences (should be 0): $resetCount"
