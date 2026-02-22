// src/components/InspectorPanel.tsx
// Debug-optimized: Shows ONLY Developer Console (no tabs)

import { LogEntry } from '../types/voice';
import { DeveloperConsole } from './DeveloperConsole';

interface InspectorPanelProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export function InspectorPanel({ logs, onClearLogs }: InspectorPanelProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Developer Console</div>
          <div className="text-xs text-slate-500">Debug mode: All events logged</div>
        </div>
      </div>

      {/* Developer Console - always visible, no tabs */}
      <div className="flex-1 overflow-hidden">
        <DeveloperConsole logs={logs} onClear={onClearLogs} />
      </div>
    </div>
  );
}

export default InspectorPanel;
