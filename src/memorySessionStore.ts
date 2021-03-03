import { Session, SessionStore } from './types'

class MemorySessionStore implements SessionStore {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map();
  }

  findSession(id: string): Session {
    return this.sessions.get(id);
  }

  saveSession(id: string, session: Session) {
    this.sessions.set(id, session);
  }

  allSessions(): Session[] {
    return [...this.sessions.values()];
  }
}

export default MemorySessionStore;