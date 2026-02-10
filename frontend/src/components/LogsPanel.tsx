import { useEffect, useMemo, useRef, useState } from 'react';
import { clearLogs, LogEntry, subscribeLogs } from '../debug/logStore';

function fmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

const levelColor: Record<string, string> = {
  SYSTEM: 'text-blue-300',
  API: 'text-cyan-300',
  MCP: 'text-emerald-300',
  LLM: 'text-purple-300',
  EVAL: 'text-yellow-300',
  ERROR: 'text-red-300',
};

export default function LogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return subscribeLogs(setLogs);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, open, filter]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return logs;
    return logs.filter((l) => l.level === filter);
  }, [logs, filter]);

  return (
    <div className="h-full rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <button
          className="font-semibold text-sm"
          onClick={() => setOpen((v) => !v)}
          title="Toggle logs"
        >
          📜 Logs <span className="text-gray-500">({logs.length})</span>
        </button>

        <div className="flex items-center gap-2">
          <select
            className="rounded border px-2 py-1 text-xs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>ALL</option>
            <option>SYSTEM</option>
            <option>API</option>
            <option>MCP</option>
            <option>LLM</option>
            <option>EVAL</option>
            <option>ERROR</option>
          </select>

          <button
            className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
            onClick={() => clearLogs()}
          >
            Clear
          </button>
        </div>
      </div>

      {open && (
        <div className="flex h-[520px] bg-neutral-950">
          {/* Left panel: Log list */}
          <div className="flex-1 overflow-auto p-2 font-mono text-[11px] text-white border-r border-gray-700">
            {filtered.length === 0 ? (
              <div className="text-gray-500 text-center py-4">No logs</div>
            ) : (
              filtered.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setSelectedLog(l)}
                  className={`mb-1 break-words cursor-pointer px-2 py-1 rounded transition-colors ${
                    selectedLog?.id === l.id ? 'bg-gray-700' : 'hover:bg-gray-800'
                  }`}
                >
                  <span className="text-gray-500">[{fmt(l.ts)}]</span>{' '}
                  <span className={levelColor[l.level] || 'text-gray-300'}>
                    {l.level}
                  </span>{' '}
                  <span className="text-gray-100">{l.message}</span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Right panel: Error details */}
          {selectedLog ? (
            <div className="flex-1 overflow-auto p-4 border-l border-gray-700 flex flex-col">
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">Details</div>
                <div className="text-sm text-gray-200 space-y-1">
                  <div><span className="text-gray-500">Time:</span> {fmt(selectedLog.ts)}</div>
                  <div><span className="text-gray-500">Level:</span> <span className={levelColor[selectedLog.level]}>{selectedLog.level}</span></div>
                  <div><span className="text-gray-500">Message:</span> {selectedLog.message}</div>
                </div>
              </div>

              {selectedLog.data && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-gray-400">Data</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedLog.data, null, 2));
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="flex-1 overflow-auto bg-black rounded p-2 text-xs text-green-400 border border-gray-800 whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedLog.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a log to view details
            </div>
          )}
        </div>
      )}
    </div>
  );
}
