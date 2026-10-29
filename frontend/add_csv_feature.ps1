$path = "C:\Users\praxh\.gemini\antigravity\scratch\ops-intelligence-engine\index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# 1. Add state variables for CSV
$oldState = @"
  // Assign New Ticket Modal state
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [newProblem, setNewProblem] = useState('');
  const [newCategory, setNewCategory] = useState('Payments');
  const [newPriority, setNewPriority] = useState('High');
  const [newDeadlineHours, setNewDeadlineHours] = useState(2.0);
  const [newSelectedTeamId, setNewSelectedTeamId] = useState('');
"@

$newState = @"
  // Assign New Ticket Modal state
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [newProblem, setNewProblem] = useState('');
  const [newCategory, setNewCategory] = useState('Payments');
  const [newPriority, setNewPriority] = useState('High');
  const [newDeadlineHours, setNewDeadlineHours] = useState(2.0);
  const [newSelectedTeamId, setNewSelectedTeamId] = useState('');

  // CSV Batch Ingestion state
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvParsedTickets, setCsvParsedTickets] = useState([]);
  const [csvError, setCsvError] = useState('');
"@

$content = $content.Replace($oldState, $newState)

# 2. Add CSV functions before handleCreateTicketSubmit
$oldSubmit = @"
  // Create new ticket submission
  const handleCreateTicketSubmit = (e) => {
"@

$newFunctions = @"
  // CSV Parser & Squad Recommendation Engine
  const parseCsvText = (text) => {
    setCsvError('');
    if (!text || !text.trim()) {
      setCsvParsedTickets([]);
      return;
    }

    try {
      const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        setCsvError('CSV must include a header row and at least one ticket data row.');
        setCsvParsedTickets([]);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const probIdx = headers.findIndex(h => h.includes('prob') || h.includes('issue') || h.includes('title') || h.includes('desc'));
      const catIdx = headers.findIndex(h => h.includes('cat') || h.includes('type'));
      const prioIdx = headers.findIndex(h => h.includes('prio') || h.includes('sev'));
      const deadIdx = headers.findIndex(h => h.includes('dead') || h.includes('hour') || h.includes('sla'));
      const teamIdx = headers.findIndex(h => h.includes('team') || h.includes('squad') || h.includes('assign'));

      if (probIdx === -1) {
        setCsvError("Missing required column 'problem' or 'title' in CSV header.");
        setCsvParsedTickets([]);
        return;
      }

      const splitCsvLine = (line) => {
        const result = [];
        let cur = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            insideQuotes = !insideQuotes;
          } else if (ch === ',' && !insideQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const parsedList = [];
      let baseIdNum = 100 + tickets.length + 1;

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length === 0 || !cols[probIdx]) continue;

        const problem = cols[probIdx].replace(/^["']|["']$/g, '').trim();
        if (!problem) continue;

        let category = catIdx !== -1 && cols[catIdx] ? cols[catIdx].replace(/^["']|["']$/g, '').trim() : 'Payments';
        const catNorm = category.toLowerCase();
        if (catNorm.includes('pay')) category = 'Payments';
        else if (catNorm.includes('bill') || catNorm.includes('refund')) category = 'Billing';
        else if (catNorm.includes('infra') || catNorm.includes('cloud') || catNorm.includes('devops')) category = 'Infrastructure';
        else if (catNorm.includes('auth') || catNorm.includes('login') || catNorm.includes('account')) category = 'Authentication';
        else category = 'Payments';

        let priority = prioIdx !== -1 && cols[prioIdx] ? cols[prioIdx].replace(/^["']|["']$/g, '').trim() : 'High';
        const prioNorm = priority.toLowerCase();
        if (prioNorm.includes('crit') || prioNorm.includes('p0')) priority = 'Critical';
        else if (prioNorm.includes('high') || prioNorm.includes('p1')) priority = 'High';
        else if (prioNorm.includes('med') || prioNorm.includes('p2')) priority = 'Medium';
        else if (prioNorm.includes('low') || prioNorm.includes('p3')) priority = 'Low';
        else priority = 'High';

        let deadlineHours = 2.0;
        if (deadIdx !== -1 && cols[deadIdx]) {
          const parsedHours = parseFloat(cols[deadIdx].replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsedHours)) deadlineHours = parsedHours;
        }

        const rec = getRecommendedSquad(category, teams);
        let chosenTeamId = rec.squad.id;

        if (teamIdx !== -1 && cols[teamIdx]) {
          const teamVal = cols[teamIdx].toLowerCase();
          const matchedTeam = teams.find(t => 
            t.id.toLowerCase() === teamVal || 
            t.name.toLowerCase().includes(teamVal) || 
            (teamVal.includes('a') && t.id === 'team-a') ||
            (teamVal.includes('b') && t.id === 'team-b') ||
            (teamVal.includes('c') && t.id === 'team-c') ||
            (teamVal.includes('d') && t.id === 'team-d')
          );
          if (matchedTeam) chosenTeamId = matchedTeam.id;
        }

        parsedList.push({
          rowId: 'row-' + i,
          ticketId: 'T' + (baseIdNum++),
          problem,
          category,
          priority,
          deadlineHours,
          assignedTeamId: chosenTeamId,
          recommendedTeamId: rec.squad.id,
          recommendationReason: rec.reason
        });
      }

      if (parsedList.length === 0) {
        setCsvError('No valid ticket rows found in CSV. Please verify column formats.');
        setCsvParsedTickets([]);
      } else {
        setCsvParsedTickets(parsedList);
      }
    } catch (err) {
      setCsvError('Failed to parse CSV: ' + err.message);
      setCsvParsedTickets([]);
    }
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      parseCsvText(event.target.result);
    };
    reader.onerror = () => {
      setCsvError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  const loadSampleCsv = () => {
    const sample = 'problem,category,priority,deadline_hours\n' +
      'Gateway timeout on Axis Bank Netbanking endpoint,Payments,Critical,1.0\n' +
      'Delayed GST invoice generation for 120 enterprise orders,Billing,High,2.5\n' +
      'Kubelet node pressure spike in US-East cluster,Infrastructure,High,1.5\n' +
      '2FA SMS code delivery failure for Jio & Airtel users,Authentication,Medium,4.0\n' +
      'Chargeback dispute webhook signature mismatch,Payments,High,2.0';
    parseCsvText(sample);
  };

  const downloadCsvTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(
      'problem,category,priority,deadline_hours,assigned_team\n' +
      'Production webhook timeout on partner bank,Payments,Critical,1.0,Team B - Payments\n' +
      'Bulk refund processing queue stalled,Billing,High,2.0,\n' +
      'Database replica latency spike in production,Infrastructure,Critical,0.5,\n' +
      'User password reset tokens failing in Safari,Authentication,Low,12.0,\n'
    );
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'sla_sentinel_batch_tickets_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCommitCsvTickets = () => {
    if (csvParsedTickets.length === 0) return;

    const teamIncrements = {};
    const newCreatedTickets = [];

    csvParsedTickets.forEach(row => {
      teamIncrements[row.assignedTeamId] = (teamIncrements[row.assignedTeamId] || 0) + 1;
      const targetSquad = teams.find(t => t.id === row.assignedTeamId) || teams[0];

      let baseRisk = 30;
      if (row.priority === 'Critical') baseRisk = 75;
      else if (row.priority === 'High') baseRisk = 55;
      else if (row.priority === 'Medium') baseRisk = 35;
      else baseRisk = 15;

      if (row.deadlineHours <= 1.0) baseRisk += 20;
      else if (row.deadlineHours <= 2.0) baseRisk += 10;

      const squadUtil = (targetSquad.activeTickets + (teamIncrements[row.assignedTeamId] || 1)) / targetSquad.maxCapacity;
      if (squadUtil >= 0.8) baseRisk += 15;
      else baseRisk -= 5;

      const finalRisk = Math.min(99, Math.max(15, baseRisk));

      newCreatedTickets.push({
        id: row.ticketId,
        problem: row.problem,
        category: row.category,
        priority: row.priority,
        pendingHours: 0.1,
        deadlineHoursLeft: parseFloat(row.deadlineHours),
        assignedTeamId: row.assignedTeamId,
        status: 'Pending',
        riskScore: finalRisk,
        riskLevel: finalRisk >= 75 ? 'High' : finalRisk >= 40 ? 'Medium' : 'Low',
        weights: { deadlinePressure: 40, squadCongestion: 35, categoryMttrLag: 15 },
        evidence: [
          'Ingested from CSV batch with ' + row.deadlineHours + 'h SLA deadline',
          'Assigned to ' + targetSquad.name + ' based on skills & capacity',
          'Initial heuristic risk score: ' + finalRisk + '/100'
        ],
        suggestedAction: 'Assigned to ' + targetSquad.name,
        actionType: 'Monitor',
        actionTaken: null,
        impactEstimate: 'SLA monitored in live queue'
      });
    });

    setTeams(prevTeams => prevTeams.map(tm => {
      const added = teamIncrements[tm.id] || 0;
      return added > 0 ? { ...tm, activeTickets: tm.activeTickets + added } : tm;
    }));

    setTickets(prev => [...newCreatedTickets, ...prev]);

    const count = newCreatedTickets.length;
    setCsvModalOpen(false);
    setCsvParsedTickets([]);
    flash('✓ Successfully ingested ' + count + ' tickets from CSV and assigned to squads!');
  };

  // Create new ticket submission
  const handleCreateTicketSubmit = (e) => {
"@

$content = $content.Replace($oldSubmit, $newFunctions)

# 3. Update Dashboard header buttons to include Import CSV
$oldDashButtons = @"
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => setNewTicketModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 shadow-2xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>+</span>
                  <span>Assign New Ticket</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}
                  className="px-4 py-2.5 rounded-2xl bg-[#132E35] hover:bg-[#0D1F23] text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>⚡</span>
                  <span>Auto-Optimize</span>
                </button>
              </div>
"@

$newDashButtons = @"
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
                  className="px-4 py-2.5 rounded-2xl bg-[#132E35] hover:bg-[#0D1F23] text-white text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>⚡</span>
                  <span>Auto-Optimize</span>
                </button>
              </div>
"@

$content = $content.Replace($oldDashButtons, $newDashButtons)

# 4. Update Tasks & Queue header buttons to include Import CSV
$oldTasksButtons = @"
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setNewTicketModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <span>+</span>
                  <span>Assign New Ticket</span>
                </button>
                <button
                  onClick={handleOpenAutoOptimizer}
                  className="px-4 py-2 rounded-xl bg-[#132E35] hover:bg-[#0D1F23] text-white text-xs font-bold transition cursor-pointer"
                >
                  ⚡ Auto-Optimize Queue
                </button>
              </div>
"@

$newTasksButtons = @"
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
                  className="px-4 py-2 rounded-xl bg-[#132E35] hover:bg-[#0D1F23] text-white text-xs font-bold transition cursor-pointer"
                >
                  ⚡ Auto-Optimize Queue
                </button>
              </div>
"@

$content = $content.Replace($oldTasksButtons, $newTasksButtons)

# 5. Add banner inside newTicketModalOpen to switch to CSV
$oldNewModalHeader = @"
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30 font-bold text-xs">
                    + Ingest Ticket
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    AI Capacity Matching
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">Assign New Incident to Squad</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Input ticket parameters. The decision engine evaluates skills and capacity to recommend the optimal squad.
                </p>
              </div>
              <button
                onClick={() => setNewTicketModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
"@

$newNewModalHeader = @"
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30 font-bold text-xs">
                    + Ingest Ticket
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    AI Capacity Matching
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">Assign New Incident to Squad</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Input ticket parameters. The decision engine evaluates skills and capacity to recommend the optimal squad.
                </p>
              </div>
              <button
                onClick={() => setNewTicketModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span>📂</span>
                <span className="text-slate-600">Assigning multiple incidents at once?</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewTicketModalOpen(false);
                  setCsvModalOpen(true);
                }}
                className="font-bold text-[#132E35] hover:underline cursor-pointer flex items-center space-x-1"
              >
                <span>Import from CSV File instead →</span>
              </button>
            </div>
"@

$content = $content.Replace($oldNewModalHeader, $newNewModalHeader)

# 6. Add CSV Ingestion & AI Assignment Modal
$csvModalBlock = @"
      {/* ═════════════════════════════════════════════════════════════
          MODAL 0: CSV BATCH TICKET INGESTION & SQUAD ASSIGNMENT
         ═════════════════════════════════════════════════════════════ */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-xs space-y-4 animate-fade-in max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#132E35]/10 text-[#132E35] border border-[#2D4A53]/30 font-bold text-xs">
                    📂 BATCH INGESTION
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    CSV Upload &amp; AI Squad Assignment
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">Assign New Tickets from CSV File</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Upload your support ticket dataset. The engine parses the tickets and assigns them to squads based on category skills and open capacity headroom.
                </p>
              </div>
              <button
                onClick={() => {
                  setCsvModalOpen(false);
                  setCsvError('');
                }}
                className="text-slate-400 hover:text-slate-700 text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* CSV Controls & Upload Area */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* File input / Drag zone */}
                <div className="border-2 border-dashed border-slate-200 hover:border-[#132E35] rounded-2xl p-4 text-center bg-slate-50 hover:bg-slate-100/60 transition flex flex-col items-center justify-center cursor-pointer relative">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span className="text-2xl mb-1">📄</span>
                  <span className="font-bold text-slate-800 text-xs">Choose .CSV File from Device</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">or drag and drop file here</span>
                </div>

                {/* Quick Demo Helper & Template */}
                <div className="flex flex-col justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block">Instant Ingestion Helpers</span>
                    <p className="text-[10px] text-slate-400">Quick-load test batch or download sample format</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={loadSampleCsv}
                      className="w-full py-2 px-3 rounded-xl bg-[#132E35] hover:bg-[#0D1F23] text-white font-bold text-[11px] transition shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
                    >
                      <span>⚡</span>
                      <span>Load Sample DEV-103 CSV (5 Tickets)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadCsvTemplate}
                      className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[10px] border border-slate-200 transition cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <span>📥</span>
                      <span>Download Sample CSV Template</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {csvError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>{csvError}</span>
                </div>
              )}
            </div>

            {/* Parsed Preview Table */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] border border-slate-200 rounded-2xl p-1 bg-white">
              {csvParsedTickets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <span className="text-3xl mb-2">📋</span>
                  <span className="font-semibold text-xs text-slate-600">No CSV Data Loaded Yet</span>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    Upload a .csv file above or click <strong>&quot;Load Sample DEV-103 CSV&quot;</strong> to preview ticket assignments and AI squad matching.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-slate-500 font-bold text-[10px] uppercase tracking-wider px-2">
                    <span>Parsed Incident ({csvParsedTickets.length} rows)</span>
                    <span>AI Recommended Squad &amp; Assignment</span>
                  </div>

                  {csvParsedTickets.map((row, idx) => {
                    const isMatch = row.assignedTeamId === row.recommendedTeamId;

                    return (
                      <div key={row.rowId || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                              {row.ticketId}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                              {row.category}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              row.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                              row.priority === 'High' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {row.priority}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {row.deadlineHours}h SLA
                            </span>
                          </div>
                          <div className="font-semibold text-slate-900 text-xs truncate">
                            {row.problem}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            💡 {row.recommendationReason}
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex items-center space-x-2">
                          <select
                            value={row.assignedTeamId}
                            onChange={e => {
                              const newTeamId = e.target.value;
                              setCsvParsedTickets(prev => prev.map((item, i) => i === idx ? { ...item, assignedTeamId: newTeamId } : item));
                            }}
                            className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#132E35]"
                          >
                            {teams.map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.name} ({tm.activeTickets}/{tm.maxCapacity})
                              </option>
                            ))}
                          </select>
                          {isMatch && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              ✓ AI Match
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                {csvParsedTickets.length > 0 ? (
                  <span>Ready to assign <strong>{csvParsedTickets.length} incidents</strong> across operational squads</span>
                ) : (
                  <span>No data pending ingestion</span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setCsvModalOpen(false);
                    setCsvError('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={csvParsedTickets.length === 0}
                  onClick={handleCommitCsvTickets}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center space-x-1.5 ${
                    csvParsedTickets.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#132E35] hover:bg-[#0D1F23] text-white'
                  }`}
                >
                  <span>✓</span>
                  <span>Assign {csvParsedTickets.length} Tickets to Squads →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

"@

$modalInsertAnchor = "      {/* ═════════════════════════════════════════════════════════════`r`n          MODAL 1: ASSIGN NEW TICKET & AI SQUAD RECOMMENDATION"
if ($content.Contains($modalInsertAnchor)) {
    $content = $content.Replace($modalInsertAnchor, $csvModalBlock + $modalInsertAnchor)
} else {
    # Try alternate line endings
    $modalInsertAnchorAlt = "      {/* ═════════════════════════════════════════════════════════════`n          MODAL 1: ASSIGN NEW TICKET & AI SQUAD RECOMMENDATION"
    $content = $content.Replace($modalInsertAnchorAlt, $csvModalBlock + $modalInsertAnchorAlt)
}

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output "Successfully added CSV ingestion to index.html!"
