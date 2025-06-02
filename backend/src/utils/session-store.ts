// utils/session-store.ts - Enhanced to handle full Bluesky sessions
interface BlueskySessionData {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  email?: string;
  active?: boolean;
  createdAt: string;
}

const sessionStore = new Map<string, BlueskySessionData>();

export function saveSession(sessionId: string, data: BlueskySessionData) {
  sessionStore.set(sessionId, data);
  console.log(`Session saved: ${sessionId.substring(0, 8)}... for ${data.handle}`);
}

export function getSession(sessionId: string): BlueskySessionData | null {
  return sessionStore.get(sessionId) || null;
}

export function clearSession(sessionId: string) {
  const session = sessionStore.get(sessionId);
  if (session) {
    sessionStore.delete(sessionId);
    console.log(`Session cleared: ${sessionId.substring(0, 8)}... for ${session.handle}`);
  }
}

export function getAllSessions(): BlueskySessionData[] {
  return Array.from(sessionStore.values());
}

export function getSessionStats() {
  const sessions = Array.from(sessionStore.values());
  return {
    total: sessions.length,
    withTokens: sessions.filter(s => s.accessJwt && s.refreshJwt).length,
    active: sessions.filter(s => s.active !== false).length
  };
}