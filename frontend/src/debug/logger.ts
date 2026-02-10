export type ApiLogEntry = {
  id: string;
  ts: number;
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  request?: any;
  response?: any;
  error?: string;
};

type Listener = (logs: ApiLogEntry[]) => void;

const logs: ApiLogEntry[] = [];
const listeners = new Set<Listener>();

export function addLog(entry: ApiLogEntry) {
  logs.unshift(entry); // newest first
  if (logs.length > 200) logs.pop();
  listeners.forEach((l) => l([...logs]));
}

export function subscribeLogs(listener: Listener): () => void {
  listeners.add(listener);
  listener([...logs]);
  return () => {
    listeners.delete(listener);
  };
}

export function clearLogs() {
  logs.length = 0;
  listeners.forEach((l) => l([...logs]));
}

export function nowId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
