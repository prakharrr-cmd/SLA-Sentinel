import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { opsApi } from '../services/api';

export default function DatasetSelectorModal({
  isOpen,
  onClose,
  currentDatasetId,
  onSelectDataset,
  onClearToDemo,
  onOpenUploadModal,
}) {
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [inspectingDataset, setInspectingDataset] = useState(null);
  const [inspectingTickets, setInspectingTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchDatasets = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const list = await opsApi.getDatasets();
        if (isMounted) {
          setDatasets(list);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to list datasets');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDatasets();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleInspect = async (ds) => {
    setInspectingDataset(ds);
    setTicketsLoading(true);
    try {
      const ticketsRes = await opsApi.getDatasetTickets(ds.id, { page: 1, pageSize: 20 });
      setInspectingTickets(ticketsRes.items || []);
    } catch (err) {
      console.error(err);
      setInspectingTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E2EAE5] max-w-3xl w-full p-6 sm:p-7 rounded-2xl shadow-2xl text-xs max-h-[92vh] flex flex-col justify-between my-auto text-[#172B28]">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#E2EAE5] mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-[#DCE9E1]/70 border border-[#145C43]/20 text-[#145C43] rounded-md">
                  DATASET REPOSITORY
                </span>
                <span className="text-xs text-[#667873]">Ingested Operational Datasets</span>
              </div>
              <h3 className="text-base font-bold text-[#172B28] mt-1">
                Select or Manage Operational Datasets
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-[#667873] hover:text-[#172B28] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs shadow-2xs">
              <strong>Error:</strong> {errorMsg}
            </div>
          )}

          {isLoading && (
            <div className="p-8 text-center text-[#667873] font-mono">
              Loading ingested datasets...
            </div>
          )}

          {!isLoading && datasets.length === 0 && (
            <div className="p-8 text-center bg-[#F4F7F5] border border-[#E2EAE5] rounded-xl text-[#667873]">
              <div className="text-sm font-bold text-[#172B28] mb-1">No Custom Datasets Found</div>
              <p className="text-xs max-w-md mx-auto mb-4">
                You are currently operating on simulated benchmark data. Ingest an operational CSV or Excel sheet to activate empirical SLA measurement.
              </p>
              <button
                onClick={onOpenUploadModal}
                className="px-4 py-2 bg-[#145C43] hover:bg-[#103D30] text-white font-bold rounded-xl shadow-2xs cursor-pointer transition"
              >
                + Ingest First Dataset
              </button>
            </div>
          )}

          {/* Dataset Grid */}
          {!isLoading && datasets.length > 0 && !inspectingDataset && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {datasets.map((ds) => {
                const isSelected = ds.id === currentDatasetId;
                return (
                  <div
                    key={ds.id}
                    className={`p-4 border rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#145C43] bg-[#DCE9E1]/30 shadow-2xs'
                        : 'border-[#E2EAE5] bg-white hover:bg-[#F4F7F5]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#172B28] text-sm">
                          {ds.name || ds.id}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#145C43] text-white font-bold">
                            CURRENT ACTIVE
                          </span>
                        )}
                        {ds.is_simulated && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            Simulated
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#667873] font-mono flex items-center space-x-3">
                        <span>ID: <strong className="text-[#172B28]">{ds.id}</strong></span>
                        <span>•</span>
                        <span>Tickets: <strong className="text-[#172B28]">{ds.valid_ticket_count || ds.ticket_count || 0}</strong></span>
                        <span>•</span>
                        <span>Created: {new Date(ds.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleInspect(ds)}
                        className="px-3 py-1.5 border border-[#E2EAE5] bg-white hover:bg-[#F4F7F5] text-[#172B28] rounded-xl text-xs font-semibold cursor-pointer transition shadow-2xs"
                      >
                        Inspect Rows
                      </button>
                      <button
                        disabled={isSelected}
                        onClick={() => {
                          onSelectDataset(ds.id);
                          onClose();
                        }}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs ${
                          isSelected
                            ? 'bg-[#E2EAE5] text-[#667873] cursor-not-allowed'
                            : 'bg-[#145C43] hover:bg-[#103D30] text-white'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Switch To Dataset'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inspection View */}
          {inspectingDataset && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#F4F7F5] p-3 border border-[#E2EAE5] rounded-xl">
                <div>
                  <span className="text-xs text-[#667873]">Inspecting:</span>{' '}
                  <strong className="text-xs font-bold text-[#172B28]">{inspectingDataset.name || inspectingDataset.id}</strong>
                </div>
                <button
                  onClick={() => setInspectingDataset(null)}
                  className="text-xs text-[#145C43] font-bold hover:underline cursor-pointer"
                >
                  ← Back to List
                </button>
              </div>

              {ticketsLoading ? (
                <div className="p-8 text-center text-[#667873] font-mono">
                  Loading tickets from dataset...
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto border border-[#E2EAE5] rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4F7F5] text-[#667873] text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="p-2 border-b border-[#E2EAE5]">ID</th>
                        <th className="p-2 border-b border-[#E2EAE5]">Priority</th>
                        <th className="p-2 border-b border-[#E2EAE5]">Status</th>
                        <th className="p-2 border-b border-[#E2EAE5]">Squad</th>
                        <th className="p-2 border-b border-[#E2EAE5]">Subject / Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2EAE5] font-mono text-[11px]">
                      {inspectingTickets.slice(0, 15).map((t) => (
                        <tr key={t.id} className="hover:bg-[#F4F7F5]">
                          <td className="p-2 font-bold text-[#172B28]">{t.id}</td>
                          <td className="p-2 text-[#667873]">{t.priority || '—'}</td>
                          <td className="p-2 text-[#667873]">{t.status}</td>
                          <td className="p-2 text-[#667873]">{t.assigned_team_id || '—'}</td>
                          <td className="p-2 text-[#172B28] truncate max-w-xs">{t.subject || t.title || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#E2EAE5] flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClearToDemo();
                onClose();
              }}
              className="px-3.5 py-1.5 border border-[#E2EAE5] rounded-xl text-xs text-[#667873] hover:text-[#172B28] hover:bg-[#F4F7F5] transition cursor-pointer"
            >
              Reset to Baseline Demo
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-[#E2EAE5] rounded-xl text-xs text-[#667873] hover:text-[#172B28] hover:bg-[#F4F7F5] transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={onOpenUploadModal}
              className="px-4 py-1.5 bg-[#145C43] hover:bg-[#103D30] text-white font-bold rounded-xl shadow-2xs transition cursor-pointer"
            >
              + Ingest New CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
