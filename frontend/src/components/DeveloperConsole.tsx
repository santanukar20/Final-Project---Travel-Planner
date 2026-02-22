// src/components/DeveloperConsole.tsx
// Developer Console - Real-time logging panel

import { useState, useEffect, useRef, useMemo } from 'react';
import { LogEntry, LogCategory, LogLevel } from '../types/voice';

interface DeveloperConsoleProps {
  logs: LogEntry[];
  onClear: () => void;
}

const CATEGORY_COLORS: Record<LogCategory, string> = {
  API: 'bg-blue-100 text-blue-800',
  STATE: 'bg-purple-100 text-purple-800',
  INTENT: 'bg-green-100 text-green-800',
  CONSTRAINT: 'bg-yellow-100 text-yellow-800',
  DIFF: 'bg-orange-100 text-orange-800',
  ERROR: 'bg-red-100 text-red-800',
  STT: 'bg-cyan-100 text-cyan-800',
  SYSTEM: 'bg-gray-100 text-gray-800',
  CITY_LOCK: 'bg-amber-100 text-amber-800',
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'text-slate-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

export function DeveloperConsole({ logs, onClear }: DeveloperConsoleProps) {
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'ALL'>('ALL');
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showData, setShowData] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterCategory !== 'ALL' && log.category !== filterCategory) return false;
      if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
      return true;
    });
  }, [logs, filterCategory, filterLevel]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Export logs
  const handleExport = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dev-console-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy logs to clipboard
  const handleCopy = async () => {
    const logsText = filteredLogs
      .map(log => `[${formatTime(log.timestamp)}] [${log.category}] ${log.message}${log.data ? '\n  ' + JSON.stringify(log.data) : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(logsText);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  // Toggle data display
  const toggleData = (id: string) => {
    const newSet = new Set(showData);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setShowData(newSet);
  };

  // Format timestamp
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as LogCategory | 'ALL')}
          className="rounded border px-2 py-1 text-xs"
        >
          <option value="ALL">All Categories</option>
          <option value="API">API</option>
          <option value="STATE">STATE</option>
          <option value="INTENT">INTENT</option>
          <option value="CONSTRAINT">CONSTRAINT</option>
          <option value="DIFF">DIFF</option>
          <option value="ERROR">ERROR</option>
          <option value="STT">STT</option>
          <option value="SYSTEM">SYSTEM</option>
          <option value="CITY_LOCK">CITY_LOCK</option>
        </select>

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'ALL')}
          className="rounded border px-2 py-1 text-xs"
        >
          <option value="ALL">All Levels</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>

        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded"
          />
          Auto-scroll
        </label>

        <div className="flex-1" />

        <button
          onClick={onClear}
          className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
        >
          Clear
        </button>
        <button
          onClick={handleCopy}
          className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
          title="Copy logs to clipboard"
        >
          Copy
        </button>
        <button
          onClick={handleExport}
          className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
        >
          Export
        </button>
      </div>

      {/* Log count */}
      <div className="border-b px-2 py-1 text-xs text-slate-500">
        {filteredLogs.length} / {logs.length} entries
      </div>

      {/* Log stream */}
      <div ref={containerRef} className="flex-1 overflow-auto p-2 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="text-center text-slate-400 py-4">No logs yet</div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`mb-1 flex flex-col gap-0.5 rounded p-1 hover:bg-slate-50 ${LEVEL_COLORS[log.level]}`}
            >
              <div className="flex items-center gap-1">
                <span className="text-slate-400">{formatTime(log.timestamp)}</span>
                <span className={`rounded px-1 text-[10px] ${CATEGORY_COLORS[log.category]}`}>
                  {log.category}
                </span>
                {log.latency && (
                  <span className="text-blue-600">[{log.latency}ms]</span>
                )}
                <span className="flex-1">{log.message}</span>
              </div>
              {log.data && (
                <div className="ml-24">
                  <button
                    onClick={() => toggleData(log.id)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {showData.has(log.id) ? '▼' : '▶'} Data
                  </button>
                  {showData.has(log.id) && (
                    <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-1 text-[10px]">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DeveloperConsole;
