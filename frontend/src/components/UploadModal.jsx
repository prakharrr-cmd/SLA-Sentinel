import React, { useState } from 'react';
import { X, Check, CheckCircle2, AlertTriangle, RefreshCw, Sparkles, UserCheck } from 'lucide-react';
import { opsApi } from '../services/api';

const CANONICAL_FIELDS = [
  { key: 'ticket_id', label: 'Ticket ID', required: true, desc: 'Unique incident identifier' },
  { key: 'created_at', label: 'Creation Timestamp', required: true, desc: 'ISO timestamp or datetime (e.g. YYYY-MM-DD, DD-MM-YYYY)' },
  { key: 'status', label: 'Status', required: true, desc: 'Open, In Progress, Closed, Resolved, etc.' },
  { key: 'priority', label: 'Priority', required: false, desc: 'Critical, High, Medium, Low' },
  { key: 'resolution_deadline', label: 'Resolution Deadline', required: false, desc: 'Contractual resolution cutoff' },
  { key: 'response_deadline', label: 'Response Deadline', required: false, desc: 'First response target cutoff' },
  { key: 'resolved_at', label: 'Resolved Timestamp', required: false, desc: 'Final resolution timestamp' },
  { key: 'assigned_team_id', label: 'Assigned Team/Squad', required: false, desc: 'Handling squad identifier' },
  { key: 'title', label: 'Title / Problem Description', required: false, desc: 'Summary of the incident' },
  { key: 'category', label: 'Category / Domain', required: false, desc: 'Payments, Infrastructure, etc.' },
  { key: 'resolution_duration', label: 'Resolution Duration (Hours)', required: false, desc: 'Precomputed MTTR duration' },
  { key: 'response_duration', label: 'Response Duration (Hours)', required: false, desc: 'Precomputed first response duration' },
];

export default function UploadModal({ isOpen, onClose, onUploadSuccess, onDatasetImported }) {
  const [step, setStep] = useState('input'); // 'input' | 'preview' | 'report'
  const [csvText, setCsvText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [datasetName, setDatasetName] = useState('');
  const [selectedSlaTarget, setSelectedSlaTarget] = useState('resolution_deadline');
  const [sheetName, setSheetName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Preview & Mapping State
  const [previewData, setPreviewData] = useState(null);
  // mappings: { [canonicalKey]: sourceColumnName }
  const [mappings, setMappings] = useState({});
  // Track keys that were automatically populated by the mapping engine
  const [autoMappedKeys, setAutoMappedKeys] = useState(new Set());

  // Validation Report State
  const [importResult, setImportResult] = useState(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('input');
    setCsvText('');
    setSelectedFile(null);
    setDatasetName('');
    setPreviewData(null);
    setMappings({});
    setAutoMappedKeys(new Set());
    setImportResult(null);
    setErrorMsg('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setCsvText('');
      setDatasetName(file.name.replace(/\.[^/.]+$/, ''));
      setErrorMsg('');
    }
  };

  const handlePastedTextChange = (text) => {
    setCsvText(text);
    if (selectedFile) setSelectedFile(null);
    if (!datasetName) setDatasetName('Pasted Operations Dataset');
    setErrorMsg('');
  };

  const loadSampleDataset = () => {
    const sample = `ticket_id,created_at,status,priority,category,assigned_team,title,resolution_deadline,response_deadline,resolved_at,resolution_duration,response_duration
T101,2026-10-30T06:00:00Z,Open,Critical,Payments,team-a,Payment failure at checkout webhook,2026-10-30T10:00:00Z,2026-10-30T07:00:00Z,,0.0,0.5
T102,2026-10-30T07:15:00Z,In Progress,High,Infrastructure,team-c,OAuth token cluster refresh timeout,2026-10-30T12:00:00Z,2026-10-30T08:15:00Z,,0.0,0.8
T103,2026-10-30T05:00:00Z,Closed,Critical,Payments,team-a,Production gateway timeout in checkout,2026-10-30T09:00:00Z,2026-10-30T06:00:00Z,2026-10-30T08:30:00Z,3.5,0.4
T104,2026-10-29T14:00:00Z,Resolved,High,Database,team-b,Database sync replication lag,2026-10-29T20:00:00Z,2026-10-29T16:00:00Z,2026-10-29T22:30:00Z,8.5,1.2
T105,2026-10-30T08:00:00Z,Open,Medium,General,team-d,Password reset email link broken,2026-10-31T08:00:00Z,2026-10-30T12:00:00Z,,0.0,
T106,2026-10-30T08:30:00Z,Open,High,Payments,team-a,Double deduction reported on UPI,2026-10-30T14:30:00Z,2026-10-30T09:30:00Z,,0.0,0.3`;
    setCsvText(sample);
    setSelectedFile(null);
    setDatasetName('PS DEV-103 Benchmark Sample');
    setErrorMsg('');
  };

  // Step 1 -> Step 2: Fetch Preview & Initialize Automatic Column Mapping
  const handleGeneratePreview = async () => {
    if (!selectedFile && !csvText.trim()) {
      setErrorMsg('Please select a file (.csv / .xlsx) or paste CSV contents.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const preview = await opsApi.previewDataset({
        file: selectedFile,
        csvText: selectedFile ? null : csvText,
        sheetName: sheetName || null,
      });

      setPreviewData(preview);

      // Preserve previously selected user mappings if returning to step 2
      const newAutoMapped = new Set();
      setMappings((prevMappings) => {
        const nextMap = { ...prevMappings };
        Object.entries(preview.suggested_mappings || {}).forEach(([srcCol, canonKey]) => {
          if (canonKey && !nextMap[canonKey]) {
            nextMap[canonKey] = srcCol;
            newAutoMapped.add(canonKey);
          }
        });
        return nextMap;
      });
      setAutoMappedKeys(newAutoMapped);

      setStep('preview');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to inspect dataset schema.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: Get available detected columns
  const detectedColumns = previewData?.detected_columns || previewData?.headers || [];
  const totalRowsCount = previewData?.total_rows ?? previewData?.row_count ?? 0;
  const detectedDelimiter = previewData?.delimiter || ',';

  // Check missing required mappings
  const missingRequiredFields = CANONICAL_FIELDS.filter(
    (f) => f.required && (!mappings[f.key] || mappings[f.key].trim() === '')
  );

  // Step 2 -> Step 3: Execute Ingestion
  const handleConfirmImport = async () => {
    if (missingRequiredFields.length > 0) {
      setErrorMsg(
        `Missing required mappings: ${missingRequiredFields.map((f) => f.label).join(', ')}. Please assign a source column from your file.`
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      // Convert frontend mappings ({ canonKey: srcCol }) to backend contract ({ srcCol: canonKey })
      const payloadMapping = {};
      Object.entries(mappings).forEach(([canonKey, srcCol]) => {
        if (srcCol && srcCol.trim() !== '') {
          payloadMapping[srcCol] = canonKey;
        }
      });

      const res = await opsApi.importDataset({
        uploadId: previewData?.upload_id || null,
        csvText: previewData?.upload_id ? null : csvText,
        mapping: payloadMapping,
        datasetName: datasetName || 'Operations Dataset',
        selectedSlaTarget: selectedSlaTarget,
      });

      setImportResult(res);
      setStep('report');
    } catch (err) {
      setErrorMsg(err.message || 'Import execution failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3 Completion: Hand off to App
  const handleConfirmAndLoad = () => {
    if (importResult?.dataset_id) {
      if (onDatasetImported) onDatasetImported(importResult);
      if (onUploadSuccess) onUploadSuccess(importResult.dataset_id);
    }
    handleReset();
    onClose();
  };

  // Get a representative sample value from preview rows
  const getSampleValue = (mappedCol) => {
    if (!mappedCol || !previewData?.preview_rows?.length) return null;
    for (const row of previewData.preview_rows) {
      const val = row[mappedCol];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val);
      }
    }
    const fallback = previewData.preview_rows[0]?.[mappedCol];
    return fallback != null ? String(fallback) : null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E2EAE5] max-w-2xl w-full p-6 sm:p-7 rounded-2xl shadow-2xl text-xs max-h-[92vh] flex flex-col justify-between my-auto text-[#172B28]">
        {/* Header with Step Tracker */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE5] mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43] rounded-md">
                  PILLAR 1 • INTAKE PIPELINE
                </span>
                <span className="text-[11px] text-[#667873]">
                  Step {step === 'input' ? '1: File Intake' : step === 'preview' ? '2: Column Mapping & Verification' : '3: Validation Audit'}
                </span>
              </div>
              <h3 className="text-base font-bold text-[#172B28] mt-1">
                {step === 'input' && 'Upload Operational Support Dataset'}
                {step === 'preview' && 'Review Schema & Confirm Column Mappings'}
                {step === 'report' && 'Dataset Ingestion Audit Report'}
              </h3>
            </div>
            <button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="text-[#667873] hover:text-[#172B28] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs shadow-2xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Error:</strong> {errorMsg}
              </div>
            </div>
          )}

          {/* STEP 1: INPUT */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="border border-dashed border-[#E2EAE5] bg-[#F4F7F5] rounded-xl p-5 text-center">
                <label className="cursor-pointer">
                  <span className="text-xs font-bold text-[#145C43] hover:underline">
                    {selectedFile ? `Selected: ${selectedFile.name}` : 'Select .CSV or .XLSX file from device'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-[10px] text-[#667873] mt-1">
                  Supports comma, semicolon, tab, or pipe delimited CSVs with UTF-8 / UTF-8 BOM, or multi-sheet Excel workbooks (.xlsx)
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="font-semibold text-[#172B28]">Or Paste Raw CSV Data</span>
                  <button
                    onClick={loadSampleDataset}
                    className="font-bold text-[#145C43] hover:underline cursor-pointer"
                  >
                    Insert PS DEV-103 Benchmark Sample
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => handlePastedTextChange(e.target.value)}
                  placeholder="ticket_id,created_at,status,priority,resolution_deadline,..."
                  className="w-full bg-[#F4F7F5] border border-[#E2EAE5] text-[#172B28] font-mono text-[11px] p-2.5 rounded-xl focus:outline-hidden focus:bg-white focus:border-[#145C43] resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#172B28] mb-1">
                  Dataset Label / Identifier
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g. Q4 Peak Operations Wave 1"
                  className="w-full bg-[#F4F7F5] border border-[#E2EAE5] text-[#172B28] text-xs p-2.5 rounded-xl focus:outline-hidden focus:bg-white focus:border-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#172B28] mb-1">
                  Primary SLA Evaluation Focus
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSlaTarget('resolution_deadline')}
                    className={`p-2.5 border rounded-xl text-left transition cursor-pointer ${
                      selectedSlaTarget === 'resolution_deadline'
                        ? 'border-[#145C43] bg-[#DCE9E1]/30 text-[#145C43] font-bold'
                        : 'border-[#E2EAE5] bg-[#F4F7F5] text-[#667873]'
                    }`}
                  >
                    <div className="text-xs">Resolution SLA</div>
                    <div className="text-[10px] text-[#667873]">Complete end-to-end incident turnaround</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlaTarget('response_deadline')}
                    className={`p-2.5 border rounded-xl text-left transition cursor-pointer ${
                      selectedSlaTarget === 'response_deadline'
                        ? 'border-[#145C43] bg-[#DCE9E1]/30 text-[#145C43] font-bold'
                        : 'border-[#E2EAE5] bg-[#F4F7F5] text-[#667873]'
                    }`}
                  >
                    <div className="text-xs">Response SLA</div>
                    <div className="text-[10px] text-[#667873]">First squad triage or acknowledgment latency</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & MAPPING */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#F4F7F5] p-3 border border-[#E2EAE5] rounded-xl text-xs">
                <div>
                  <span className="text-[#667873]">Detected Columns:</span>{' '}
                  <strong className="text-[#172B28] font-mono">{detectedColumns.length}</strong>
                </div>
                <div>
                  <span className="text-[#667873]">Total Sample Rows:</span>{' '}
                  <strong className="text-[#172B28] font-mono">{totalRowsCount}</strong>
                </div>
                <div>
                  <span className="text-[#667873]">Delimiter:</span>{' '}
                  <strong className="text-[#172B28] font-mono">"{detectedDelimiter}"</strong>
                </div>
              </div>

              {missingRequiredFields.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center space-x-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <div>
                    <span className="font-semibold">Action Required:</span> Please map the following required attribute(s):{' '}
                    <span className="font-bold underline">{missingRequiredFields.map((f) => f.label).join(', ')}</span>
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border border-[#E2EAE5] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F7F5] text-[#667873] text-[10px] uppercase font-bold sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="p-2 border-b border-[#E2EAE5]">Standard Attribute</th>
                      <th className="p-2 border-b border-[#E2EAE5]">Source Column in File</th>
                      <th className="p-2 border-b border-[#E2EAE5]">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2EAE5]">
                    {CANONICAL_FIELDS.map((field) => {
                      const mappedCol = mappings[field.key] || '';
                      const isAuto = autoMappedKeys.has(field.key) && mappedCol !== '';
                      const sampleVal = getSampleValue(mappedCol);

                      return (
                        <tr key={field.key} className="hover:bg-[#F4F7F5]/70 transition-colors">
                          <td className="p-2">
                            <div className="font-semibold text-[#172B28] flex items-center space-x-1.5">
                              <span>{field.label}</span>
                              {field.required && (
                                <span className="text-rose-500 font-bold" title="Required field">*</span>
                              )}
                              {mappedCol && (
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                                    isAuto
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}
                                  title={isAuto ? 'Automatically matched by SLA Sentinel engine' : 'Manually selected by user'}
                                >
                                  {isAuto ? 'Auto' : 'Manual'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#667873]">{field.desc}</div>
                          </td>
                          <td className="p-2">
                            <select
                              value={mappedCol}
                              onChange={(e) => {
                                const val = e.target.value || null;
                                setMappings((prev) => ({
                                  ...prev,
                                  [field.key]: val,
                                }));
                                // Mark as manual selection
                                setAutoMappedKeys((prev) => {
                                  const updated = new Set(prev);
                                  updated.delete(field.key);
                                  return updated;
                                });
                                setErrorMsg('');
                              }}
                              className={`w-full p-1.5 border rounded-lg text-xs font-mono transition-colors ${
                                mappedCol
                                  ? 'border-[#145C43] text-[#172B28] bg-white font-semibold'
                                  : field.required
                                  ? 'border-amber-300 bg-amber-50/50 text-[#667873]'
                                  : 'border-[#E2EAE5] bg-[#F4F7F5] text-[#667873]'
                              }`}
                            >
                              <option value="">— Not Mapped —</option>
                              {detectedColumns.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 font-mono text-[10px] text-[#172B28] truncate max-w-[140px]">
                            {sampleVal != null ? (
                              <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200" title={sampleVal}>
                                {sampleVal}
                              </span>
                            ) : (
                              <span className="text-[#8A9B96] italic">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: AUDIT REPORT */}
          {step === 'report' && importResult && (
            <div className="space-y-4">
              <div className="bg-[#DCE9E1]/30 border border-[#145C43]/30 p-4 rounded-xl">
                <div className="flex items-center space-x-2 text-[#145C43] font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-[#145C43]" />
                  <span>Dataset Successfully Ingested &amp; Validated</span>
                </div>
                <div className="text-xs text-[#172B28] mt-1 font-mono">
                  Assigned Dataset ID: <strong className="text-[#145C43]">{importResult.dataset_id}</strong>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#F4F7F5] p-3 border border-[#E2EAE5] rounded-xl">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Total Rows</div>
                  <div className="text-lg font-bold text-[#172B28] font-mono mt-0.5">
                    {importResult.total_rows ?? importResult.validation_summary?.total_rows ?? 0}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] p-3 border border-[#E2EAE5] rounded-xl">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Valid Incidents</div>
                  <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
                    {importResult.accepted_rows ?? importResult.validation_summary?.valid_tickets_imported ?? 0}
                  </div>
                </div>
                <div className="bg-[#F4F7F5] p-3 border border-[#E2EAE5] rounded-xl">
                  <div className="text-[10px] text-[#667873] uppercase font-mono">Rejected Rows</div>
                  <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">
                    {importResult.rejected_rows ?? importResult.validation_summary?.rejected_rows_count ?? 0}
                  </div>
                </div>
              </div>

              {((importResult.validation_warnings && importResult.validation_warnings.length > 0) ||
                (importResult.validation_summary?.warnings && importResult.validation_summary.warnings.length > 0)) && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl max-h-32 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase text-amber-800 mb-1">
                    Quality Warnings ({importResult.validation_warnings?.length || importResult.validation_summary?.warnings?.length})
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-900 space-y-0.5 font-mono">
                    {(importResult.validation_warnings || []).map((w, idx) => (
                      <li key={idx}>Row {w.row} [{w.field}]: {w.message}</li>
                    ))}
                    {(importResult.validation_summary?.warnings || []).map((w, idx) => (
                      <li key={`summary-${idx}`}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#E2EAE5] flex items-center justify-between mt-4">
          {step === 'input' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#E2EAE5] rounded-xl hover:bg-[#F4F7F5] text-[#667873] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGeneratePreview}
                className="px-5 py-2 bg-[#145C43] hover:bg-[#103D30] text-white font-bold rounded-xl shadow-2xs transition cursor-pointer flex items-center space-x-1.5"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Inspecting Schema...</span>
                  </>
                ) : (
                  <span>Inspect &amp; Map Columns →</span>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-4 py-2 border border-[#E2EAE5] rounded-xl hover:bg-[#F4F7F5] text-[#667873] cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={isLoading || missingRequiredFields.length > 0}
                onClick={handleConfirmImport}
                className={`px-5 py-2 font-bold rounded-xl shadow-2xs transition flex items-center space-x-1.5 ${
                  missingRequiredFields.length > 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-[#145C43] hover:bg-[#103D30] text-white cursor-pointer'
                }`}
                title={missingRequiredFields.length > 0 ? `Map required fields first: ${missingRequiredFields.map(f => f.label).join(', ')}` : 'Commit validated dataset'}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Ingesting Dataset...</span>
                  </>
                ) : (
                  <span>Confirm Ingestion →</span>
                )}
              </button>
            </>
          )}

          {step === 'report' && (
            <button
              type="button"
              onClick={handleConfirmAndLoad}
              className="w-full py-2.5 bg-[#145C43] hover:bg-[#103D30] text-white font-bold rounded-xl shadow-2xs transition cursor-pointer text-center"
            >
              Load Ingested Dataset Into SLA Sentinel Workspace →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
