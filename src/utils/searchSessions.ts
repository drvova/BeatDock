import type { Track } from 'discord-player';
import type { SearchSession } from '../types/client.js';

const SESSION_MAX_AGE = 1_800_000; // 30 minutes
const CLEANUP_INTERVAL = 300_000; // 5 minutes

export class SearchSessionManager {
  private sessions = new Map<string, SearchSession>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupOldSessions(), CLEANUP_INTERVAL);
  }

  createSession(params: {
    userId: string;
    guildId: string;
    channelId: string;
    voiceChannelId: string;
    results: Track[];
    query: string;
    volume: number;
  }): string {
    const sessionId = `${params.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.sessions.set(sessionId, {
      sessionId,
      userId: params.userId,
      guildId: params.guildId,
      channelId: params.channelId,
      voiceChannelId: params.voiceChannelId,
      results: params.results,
      query: params.query,
      volume: params.volume,
      currentPage: 1,
      createdAt: Date.now(),
    });

    return sessionId;
  }

  getSession(sessionId: string): SearchSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByUser(userId: string): SearchSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) return session;
    }
    return undefined;
  }

  updatePage(sessionId: string, page: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.currentPage = page;
    return true;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanupOldSessions(maxAge = SESSION_MAX_AGE): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > maxAge) {
        this.sessions.delete(id);
      }
    }
  }

  cleanupGuildSessions(guildId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.guildId === guildId) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.sessions.clear();
  }
}
