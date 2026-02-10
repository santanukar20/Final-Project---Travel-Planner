import { useEffect, useMemo, useState } from 'react';
import { ApiLogEntry, clearLogs, subscribeLogs } from '../debug/logger';

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

export default function DebugConsole() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'fail' | 'slow'>('all');
  const [selected, setSelected] = useState<ApiLogEntry | null>(null);

  useEffect(() => {
    return subscribeLogs(setLogs);
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filter === 'fail') return l.ok === false;
      if (filter === 'slow') return (l.durationMs ?? 0) >= 2000;
      return true;
    });
  }, [logs, filter]);

  const failCount = logs.filter((l) => l.ok === false).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[520px] max-w-[95vw] font-sans">
      <div className="flex items-center justify-between rounded-xl bg-black/80 px-3 py-2 text-white shadow-lg">
        <button
          className="flex items-center gap-2"
          onClick={() => setOpen((v) => !v)}
          title="Toggle Debug Console"
        >
          <span className="text-sm font-semibold">Debug Console</span>
          <span className="text-xs opacity-80">({logs.length} logs)</span>
          {failCount > 0 && (
            <span className="ml-2 rounded bg-red-600 px-2 py-0.5 text-xs">
              {failCount} failing
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded bg-white/10 px-2 py-1 text-xs text-white outline-none"
          >
            <option value="all">All</option>
            <option value="fail">Failing</option>
            <option value="slow">Slow (&gt;=2s)</option>
          </select>

          <button
            onClick={() => {
              clearLogs();
              setSelected(null);
            }}
            className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
          >
            Clear
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-white shadow-lg">
          <div className="max-h-[360px] overflow-auto border-r p-2">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No logs.</div>
            ) : (
              filtered.map((l) => {
                const slow = (l.durationMs ?? 0) >= 2000;
                return (
                  <button
                    key={l.id}
                    onClick={() => setSelected(l)}
                    className={`mb-2 w-full rounded-lg border p-2 text-left text-xs hover:bg-gray-50 ${
                      selected?.id === l.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {l.method}{' '}
                        <span className="font-normal text-gray-600">
                          {l.url.replace(/^https?:\/\/[^/]+/, '')}
                        </span>
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 ${
                          l.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {l.ok ? 'OK' : 'FAIL'}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-gray-600">
                      <span>{fmtTime(l.ts)}</span>
                      <span className="flex items-center gap-2">
                        {typeof l.status === 'number' && <span>Status {l.status}</span>}
                        {typeof l.durationMs === 'number' && (
                          <span className={slow ? 'font-semibold text-orange-700' : ''}>
                            {l.durationMs}ms
                          </span>
                        )}
                        {slow && (
                          <span className="rounded bg-orange-100 px-2 py-0.5 text-orange-800">
                            slow
                          </span>
                        )}
                      </span>
                    </div>

                    {!l.ok && l.error && (
                      <div className="mt-1 line-clamp-2 text-red-700">{l.error}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="max-h-[360px] overflow-auto p-2">
            {!selected ? (
              <div className="p-3 text-sm text-gray-500">Select a log to inspect.</div>
            ) : (
              <div className="text-xs">
                <div className="mb-2 font-semibold">
                  {selected.method} {selected.url.replace(/^https?:\/\/[^/]+/, '')}
                </div>

                <div className="mb-2 grid grid-cols-2 gap-2">
                  <div className="rounded bg-gray-50 p-2">
                    <div className="font-semibold">Status</div>
                    <div>{selected.status ?? '-'}</div>
                  </div>
                  <div className="rounded bg-gray-50 p-2">
                    <div className="font-semibold">Duration</div>
                    <div>{selected.durationMs ?? '-'} ms</div>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="font-semibold">Request body</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-white">
                    {JSON.stringify(selected.request ?? null, null, 2)}
                  </pre>
                </div>

                <div className="mb-2">
                  <div className="font-semibold">Response body</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-white">
                    {JSON.stringify(selected.response ?? null, null, 2)}
                  </pre>
                </div>

                {selected.error && (
                  <div className="mb-2">
                    <div className="font-semibold text-red-700">Error</div>
                    <div className="mt-1 rounded bg-red-50 p-2 text-red-800">
                      {selected.error}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
