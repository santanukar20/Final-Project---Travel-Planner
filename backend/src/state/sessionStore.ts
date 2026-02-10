import { SessionState } from '@shared/types';

class SessionStore {
  private sessions: Map<string, SessionState> = new Map();

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  set(sessionId: string, state: SessionState): void {
    this.sessions.set(sessionId, state);
  }

  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  exists(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

export const sessionStore = new SessionStore();
