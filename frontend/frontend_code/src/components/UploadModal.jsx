import React, { useState } from 'react';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [csvText, setCsvText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
      setErrorMsg('');
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the file.');
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!csvText.trim()) {
      setErrorMsg('Please paste CSV contents or upload a .csv file first.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      await onUploadSuccess(csvText);
      setIsLoading(false);
      onClose();
    } catch (err) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Error processing CSV file');
    }
  };

  const loadSampleDataset = () => {
    const sample = `ticket_id,problem,category,priority,pending_hours,deadline_hours_left,assigned_team,status
T103,Production Server down in US-East cluster,Infrastructure,Critical,1.0,0.5,Team C - DevOps,Pending
T104,Refund delay for 45 pending orders,Billing,High,10.0,-2.0,Team A - Payments,Escalated
T101,Payment failure at checkout webhook,Payments,High,5.0,1.0,Team A - Payments,Pending
T102,OAuth login issue on iOS app,Authentication,Medium,2.0,8.0,Team D - Support,In Progress
T105,Password reset email link broken,Authentication,Low,1.0,24.0,Team D - Support,Pending
T106,Double deduction on UPI transaction,Payments,High,4.5,1.2,Team A - Payments,Pending`;
    setCsvText(sample);
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#132E35] border border-[#2D4A53] max-w-lg w-full p-6 shadow-2xl text-xs">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2D4A53] mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#AFB3B7]">
              Import Operations Dataset
            </h3>
            <p className="text-[11px] text-[#69818D]">
              Ingest raw support tickets, deadlines, and squad telemetry
            </p>
          </div>
          <button onClick={onClose} className="text-[#69818D] hover:text-[#AFB3B7] p-1 cursor-pointer">
            ✕
          </button>
        </div>

        {/* File Chooser (Sharp edges) */}
        <div className="border border-dashed border-[#2D4A53] bg-[#0D1F23] p-4 text-center mb-4">
          <label className="cursor-pointer">
            <span className="text-xs font-bold text-[#AFB3B7] hover:underline">
              Select .CSV file from device
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <p className="text-[10px] text-[#69818D] mt-1">or paste raw CSV text below</p>
        </div>

        {/* Text Area */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="font-semibold text-[#AFB3B7]">Raw CSV Data</span>
            <button
              onClick={loadSampleDataset}
              className="font-bold text-[#AFB3B7] hover:underline cursor-pointer"
            >
              Insert PS DEV-103 Sample Data
            </button>
          </div>
          <textarea
            rows="5"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="ticket_id,problem,category,priority,pending_hours,deadline_hours_left,assigned_team,status"
            className="w-full text-xs font-mono p-3 bg-[#0D1F23] border border-[#2D4A53] text-[#AFB3B7] placeholder-[#69818D] focus:outline-none focus:border-[#AFB3B7]"
          ></textarea>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 mb-4">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#2D4A53]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#69818D] hover:text-[#AFB3B7] bg-[#0D1F23] border border-[#2D4A53] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleProcess}
            disabled={isLoading}
            className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-[#2D4A53] hover:bg-[#395d68] text-[#AFB3B7] border border-[#5A636A] shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Process & Score Tickets'}
          </button>
        </div>

      </div>
    </div>
  );
}
