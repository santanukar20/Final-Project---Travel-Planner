export type LogLevel = "SYSTEM" | "API" | "MCP" | "LLM" | "EVAL" | "ERROR";

export type LogEntry = {
  id: string;
  ts: number;
  level: LogLevel;
  message: string;
  data?: any;
};

type Listener = (logs: LogEntry[]) => void;

const logs: LogEntry[] = [];
const listeners = new Set<Listener>();

const generateId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function pushLog(level: LogLevel, message: string, data?: any) {
  logs.push({ id: generateId(), ts: Date.now(), level, message, data });
  if (logs.length > 500) logs.shift();
  listeners.forEach((l) => l([...logs]));
}

export function subscribeLogs(listener: Listener) {
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
