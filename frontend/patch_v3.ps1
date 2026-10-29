$path = "C:\Users\praxh\.gemini\antigravity\scratch\ops-intelligence-engine\index.html"
$c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# ── 1. LIGHTER COLOUR PALETTE ──────────────────────────────────────────────
# Old primary dark:  #132E35  → New lighter teal-green:  #1F5C6B
# Old deepest base:  #0D1F23  → New lighter base:        #174955
# Old mid accent:    #2D4A53  → New mid accent:           #3D7080
# Badge text stays but badge background also updated
$c = $c.Replace('#132E35', '#1F5C6B')
$c = $c.Replace('#0D1F23', '#174955')
$c = $c.Replace('#2D4A53', '#3D7080')

# Fix the waves gradient rgba values
$c = $c.Replace('rgba(105,129,141,.25)', 'rgba(61,112,128,.30)')
$c = $c.Replace('rgba(13,31,35,.60)',    'rgba(23,73,85,.55)')

# Fix border-[#0D1F23] references (already replaced by #174955 above)

# ── 2. REMOVE "Reset Baseline" button from sidebar ──────────────────────────
$resetBtn = @"
              <button
                onClick={resetData}
                className="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 cursor-pointer flex items-center space-x-2"
              >
                <span>↺</span>
                <span>Reset Baseline</span>
              </button>
"@
$c = $c.Replace($resetBtn, '')

# ── 3. REMOVE "GENERAL CONTROLS" section label (now only Sign Out remains) ──
# Keep the sign-out button but remove the "Controls" heading and section wrapper
$oldControls = @"
          {/* GENERAL CONTROLS */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-2">Controls</div>
            <nav className="space-y-1">
              <button
                onClick={handleLogout}
                className="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center space-x-2"
              >
                <span>→</span>
                <span>Sign Out</span>
              </button>
            </nav>
          </div>
"@

$newControls = @"
          {/* Sign Out */}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center space-x-2"
          >
            <span>→</span>
            <span>Sign Out</span>
          </button>
"@
$c = $c.Replace($oldControls, $newControls)

# ── 4. REMOVE manual "+ Assign Ticket" button from Dashboard header ─────────
# Keep only Import CSV + Auto-Optimize on the Dashboard
$oldDashBtns = @"
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>📂</span>
                  <span>Import CSV</span>
                </button>
                <button
                  onClick={() => setNewTicketModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>+</span>
                  <span>Assign Ticket</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}
                  className="px-4 py-2.5 rounded-2xl bg-[#1F5C6B] hover:bg-[#174955] text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>⚡</span>
                  <span>Auto-Optimize</span>
                </button>
              </div>
"@

$newDashBtns = @"
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>📂</span>
                  <span>Import CSV</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}
                  className="px-4 py-2.5 rounded-2xl bg-[#1F5C6B] hover:bg-[#174955] text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>⚡</span>
                  <span>Auto-Optimize</span>
                </button>
              </div>
"@
$c = $c.Replace($oldDashBtns, $newDashBtns)

# ── 5. REMOVE manual "+ Assign Ticket" button from Tasks & Queue header ──────
$oldTaskBtns = @"
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>📂</span>
                  <span>Import CSV</span>
                </button>
                <button
                  onClick={() => setNewTicketModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>+</span>
                  <span>Assign Ticket</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}
                  className="px-4 py-2 rounded-xl bg-[#1F5C6B] hover:bg-[#174955] text-white text-xs font-bold transition cursor-pointer"
                >
                  ⚡ Auto-Optimize Queue
                </button>
              </div>
"@

$newTaskBtns = @"
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCsvModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>📂</span>
                  <span>Import CSV</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}
                  className="px-4 py-2 rounded-xl bg-[#1F5C6B] hover:bg-[#174955] text-white text-xs font-bold transition cursor-pointer"
                >
                  ⚡ Auto-Optimize Queue
                </button>
              </div>
"@
$c = $c.Replace($oldTaskBtns, $newTaskBtns)

# ── 6. TASKS TAB – FIT TABLE INSIDE CONTAINER, NO HORIZONTAL OVERFLOW ────────
# Make the ticket table responsive – no horizontal scroll, compress columns
$oldTableWrapper = '<div className="overflow-x-auto">'
$newTableWrapper = '<div className="overflow-x-auto w-full min-w-0">'
$c = $c.Replace($oldTableWrapper, $newTableWrapper)

# Make table use table-fixed layout and compress padding
$oldTable = '<table className="w-full text-left text-xs">'
$newTable = '<table className="w-full text-left text-xs table-fixed">'
$c = $c.Replace($oldTable, $newTable)

# Compress column headings to tight padding
$c = $c.Replace('<th className="py-3.5 px-6">ID</th>', '<th className="py-3 px-3 w-16">ID</th>')
$c = $c.Replace('<th className="py-3.5 px-6">Problem</th>', '<th className="py-3 px-3">Problem</th>')
$c = $c.Replace('<th className="py-3.5 px-6">Priority</th>', '<th className="py-3 px-3 w-24">Priority</th>')
$c = $c.Replace('<th className="py-3.5 px-6">SLA Countdown</th>', '<th className="py-3 px-3 w-28">SLA Left</th>')
$c = $c.Replace('<th className="py-3.5 px-6">Risk Rating</th>', '<th className="py-3 px-3 w-20">Risk</th>')
$c = $c.Replace('<th className="py-3.5 px-6">Assigned Squad</th>', '<th className="py-3 px-3 w-32">Squad</th>')
$c = $c.Replace('<th className="py-3.5 px-6 text-right">Actions</th>', '<th className="py-3 px-3 w-36 text-right">Actions</th>')

# Compress row cell padding
$c = $c.Replace('<td className="py-4 px-6 font-mono font-bold text-slate-900">', '<td className="py-3 px-3 font-mono font-bold text-slate-900">')
$c = $c.Replace('<td className="py-4 px-6 max-w-sm">', '<td className="py-3 px-3">')
$c = $c.Replace('<td className="py-4 px-6">' + [Environment]::NewLine + '                            <span className={`px-2.5', '<td className="py-3 px-3">' + [Environment]::NewLine + '                            <span className={`px-2.5')
$c = $c.Replace('<td className="py-4 px-6 whitespace-nowrap">' + [Environment]::NewLine + '                            <span className={`font-semibold', '<td className="py-3 px-3 whitespace-nowrap">' + [Environment]::NewLine + '                            <span className={`font-semibold')
$c = $c.Replace('<td className="py-4 px-6 whitespace-nowrap">' + [Environment]::NewLine + '                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono', '<td className="py-3 px-3 whitespace-nowrap">' + [Environment]::NewLine + '                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono')
$c = $c.Replace('<td className="py-4 px-6 whitespace-nowrap">' + [Environment]::NewLine + '                            <div className="font-semibold text-slate-900">', '<td className="py-3 px-3 whitespace-nowrap">' + [Environment]::NewLine + '                            <div className="font-semibold text-slate-900 text-[11px] truncate">')
$c = $c.Replace('<td className="py-4 px-6 text-right whitespace-nowrap">', '<td className="py-3 px-3 text-right whitespace-nowrap">')

# ── 7. REMOVE the stray "Incident Stream + New button" from dashboard tab ────
# The "+ New" button inside the incident stream card on dashboard also triggers newTicketModal
$oldIncidentNew = @"
                <button onClick={() => setNewTicketModalOpen(true)} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer">
                    + New
                  </button>
"@
$c = $c.Replace($oldIncidentNew, '')

# ── 8. ALSO clean up the "CSV instead →" prompt in the newTicketModal ─────────
# Since manager can't add tickets manually, this modal can stay (it's CSV-routed)
# but the modal itself may stay for template download / sample purposes.
# The simplest approach: remove the manual modal trigger entirely from the remaining
# references. They were already removed from Dashboard + Tasks headers above.
# Check for any remaining "+ New" / newTicketModalOpen triggers in the Incident Stream card
$c = $c -replace 'onClick=\{.*?setNewTicketModalOpen\(true\).*?\}', 'onClick={() => setCsvModalOpen(true)}'

[System.IO.File]::WriteAllText($path, $c, [System.Text.Encoding]::UTF8)
Write-Output "patch_v3 applied successfully!"
