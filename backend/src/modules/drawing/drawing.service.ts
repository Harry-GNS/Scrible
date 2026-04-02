import { getUtcDayKey } from '../../shared/utc.js';

const ALLOWED_DURATIONS = new Set([1, 5, 10, 15]);

class DrawingService {
  private readonly claims = new Map<string, Set<number>>();

  getDayKeyUtc(): string {
    return getUtcDayKey();
  }

  isValidDuration(duration: number): boolean {
    return ALLOWED_DURATIONS.has(duration);
  }

  canClaim(userId: string, duration: number): boolean {
    const key = this.buildClaimKey(userId);
    const durations = this.claims.get(key);
    if (!durations) {
      return true;
    }

    return !durations.has(duration);
  }

  claim(userId: string, duration: number): boolean {
    const key = this.buildClaimKey(userId);
    const durations = this.claims.get(key) ?? new Set<number>();

    if (durations.has(duration)) {
      return false;
    }

    durations.add(duration);
    this.claims.set(key, durations);
    return true;
  }

  private buildClaimKey(userId: string): string {
    return `${userId.trim()}::${this.getDayKeyUtc()}`;
  }
}

export const drawingService = new DrawingService();
