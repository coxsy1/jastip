import crypto from "node:crypto";
import { db } from "../db/client.js";

export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  token: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}

export class RefreshTokenRepository {
  /**
   * Hashes a token string using SHA-256 for secure DB storage.
   */
  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Creates and stores a new refresh token record.
   */
  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenEntity> {
    const tokenHash = this.hashToken(input.token);
    return db.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
      },
    });
  }

  /**
   * Finds a token record by its token string.
   */
  async findByToken(token: string): Promise<RefreshTokenEntity | null> {
    const tokenHash = this.hashToken(token);
    return db.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * Marks a specific token as revoked.
   */
  async revokeToken(id: string): Promise<void> {
    await db.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revokes all active refresh tokens for a user (e.g. on logout, password change, or reuse detection).
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await db.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
