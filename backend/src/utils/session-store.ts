const sessionStore = new Map<string, any>();

export function saveSession(sessionId: string, data: any) {
  sessionStore.set(sessionId, data);
}

export function getSession(sessionId: string) {
  return sessionStore.get(sessionId);
}
