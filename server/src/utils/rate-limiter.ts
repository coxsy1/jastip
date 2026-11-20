interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly store: Map<string, RateLimitRecord> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Periodic cleanup of expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref?.();
  }

  /**
   * Check if the key is currently blocked.
   */
  isBlocked(key: string): { blocked: boolean; retryAfterMs: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record) {
      return { blocked: false, retryAfterMs: 0 };
    }

    if (now > record.resetAt) {
      this.store.delete(key);
      return { blocked: false, retryAfterMs: 0 };
    }

    if (record.count >= this.maxAttempts) {
      return { blocked: true, retryAfterMs: record.resetAt - now };
    }

    return { blocked: false, retryAfterMs: 0 };
  }

  /**
   * Records a failed attempt for the given key.
   */
  recordFailure(key: string): { blocked: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now > record.resetAt) {
      record = {
        count: 1,
        resetAt: now + this.windowMs,
      };
      this.store.set(key, record);
      return {
        blocked: false,
        remaining: this.maxAttempts - 1,
        retryAfterMs: this.windowMs,
      };
    }

    record.count += 1;
    const isNowBlocked = record.count >= this.maxAttempts;

    return {
      blocked: isNowBlocked,
      remaining: Math.max(0, this.maxAttempts - record.count),
      retryAfterMs: Math.max(0, record.resetAt - now),
    };
  }

  /**
   * Resets attempts upon successful operation.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global login rate limiter instance: 5 attempts per 15 minutes (PRD AUTH-4)
export const loginRateLimiter = new InMemoryRateLimiter(5, 15 * 60 * 1000);
