import type { LoginInput, RegisterInput, ChangePasswordInput } from "../validators/auth.validator.js";
import type { UserEntity } from "../repositories/user.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import {
  hashPassword,
  comparePassword,
  comparePasswordDummy,
  validatePasswordPolicy,
} from "../utils/password.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from "../utils/jwt.js";
import { AppError } from "../utils/error.js";
import { ERROR_CODES } from "../constants/index.js";
import { writeAuditLog } from "../utils/audit.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: Omit<UserEntity, "password" | "refreshToken">;
  tokens: AuthTokens;
}

export interface ClientMeta {
  ip?: string | null;
  userAgent?: string | null;
}

function buildPayload(user: UserEntity): TokenPayload {
  return { userId: user.id, email: user.email, role: user.role };
}

function sanitizeUser(user: UserEntity): Omit<UserEntity, "password" | "refreshToken"> {
  const { password: _p, refreshToken: _rt, ...safeUser } = user;
  return safeUser;
}

export class AuthService {
  /**
   * Authenticates user with anti-enumeration protection, records login time,
   * stores refresh token in multi-device table.
   */
  async login(input: LoginInput, meta?: ClientMeta): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();
    const user = await userRepository.findByEmail(email);

    if (!user) {
      // Mitigate timing attack & user enumeration
      await comparePasswordDummy(input.password);
      throw AppError.unauthorized("Email atau password salah", ERROR_CODES.INVALID_CREDENTIALS);
    }

    const passwordMatch = await comparePassword(input.password, user.password!);

    if (!user.isActive) {
      throw AppError.forbidden("Akun nonaktif. Silakan hubungi Owner.", ERROR_CODES.USER_INACTIVE);
    }

    if (!passwordMatch) {
      throw AppError.unauthorized("Email atau password salah", ERROR_CODES.INVALID_CREDENTIALS);
    }

    // Update last login timestamp
    await userRepository.updateLastLogin(user.id);

    const payload = buildPayload(user);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save refresh token to dedicated multi-device table (expires in 7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await refreshTokenRepository.create({
      userId: user.id,
      token: refreshToken,
      expiresAt,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    });

    // Write audit log for login
    await writeAuditLog({
      actorId: user.id,
      entity: "users",
      entityId: user.id,
      action: "LOGIN",
      after: { ip: meta?.ip, userAgent: meta?.userAgent },
    });

    return { user: sanitizeUser(user), tokens: { accessToken, refreshToken } };
  }

  /**
   * Registers a new user account.
   */
  async register(input: RegisterInput, meta?: ClientMeta): Promise<AuthResult> {
    const email = input.email.toLowerCase().trim();

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict("Email sudah terdaftar", ERROR_CODES.CONFLICT);
    }

    if (!validatePasswordPolicy(input.password)) {
      throw AppError.badRequest(
        "Password minimal 8 karakter dan wajib mengandung kombinasi huruf dan angka",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const hashedPassword = await hashPassword(input.password);

    const user = await userRepository.create({
      email,
      name: input.name.trim(),
      password: hashedPassword,
      role: input.role,
      mustChangePassword: false,
    });

    const payload = buildPayload(user);
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await refreshTokenRepository.create({
      userId: user.id,
      token: refreshToken,
      expiresAt,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    });

    return { user: sanitizeUser(user), tokens: { accessToken, refreshToken } };
  }

  /**
   * Retrieves profile information of the currently authenticated user.
   */
  async getProfile(userId: string): Promise<Omit<UserEntity, "password" | "refreshToken">> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound("User tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }
    return sanitizeUser(user);
  }

  /**
   * Rotates refresh token: verifies current token, detects reuse, issues new token pair.
   */
  async refreshToken(token: string, meta?: ClientMeta): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken<TokenPayload>(token);
    } catch {
      throw AppError.unauthorized("Refresh token tidak valid atau sudah expired", ERROR_CODES.TOKEN_EXPIRED);
    }

    const tokenRecord = await refreshTokenRepository.findByToken(token);

    // Reuse detection: if token is already revoked or missing, revoke all user tokens!
    if (!tokenRecord || tokenRecord.revokedAt) {
      if (tokenRecord) {
        await refreshTokenRepository.revokeAllUserTokens(tokenRecord.userId);
      }
      throw AppError.unauthorized("Refresh token telah dibatalkan atau terindikasi digunakan ulang", ERROR_CODES.TOKEN_EXPIRED);
    }

    if (new Date() > tokenRecord.expiresAt) {
      await refreshTokenRepository.revokeToken(tokenRecord.id);
      throw AppError.unauthorized("Refresh token sudah expired", ERROR_CODES.TOKEN_EXPIRED);
    }

    const user = await userRepository.findById(payload.userId);
    if (!user || !user.isActive) {
      await refreshTokenRepository.revokeToken(tokenRecord.id);
      throw AppError.forbidden("Akun tidak aktif", ERROR_CODES.USER_INACTIVE);
    }

    // Revoke old token (Rotation)
    await refreshTokenRepository.revokeToken(tokenRecord.id);

    // Issue new token pair
    const newPayload = buildPayload(user);
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await refreshTokenRepository.create({
      userId: user.id,
      token: newRefreshToken,
      expiresAt,
      userAgent: meta?.userAgent,
      ip: meta?.ip,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logs out user: revokes either the specific refresh token or all user tokens.
   */
  async logout(userId: string, token?: string): Promise<void> {
    if (token) {
      const record = await refreshTokenRepository.findByToken(token);
      if (record && record.userId === userId) {
        await refreshTokenRepository.revokeToken(record.id);
        return;
      }
    }
    // Revoke all tokens for the user
    await refreshTokenRepository.revokeAllUserTokens(userId);
  }

  /**
   * Changes authenticated user password, sets mustChangePassword = false, and revokes all active sessions.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound("User tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    const isMatch = await comparePassword(input.oldPassword, user.password!);
    if (!isMatch) {
      throw AppError.unauthorized("Password lama salah", ERROR_CODES.INVALID_CREDENTIALS);
    }

    if (!validatePasswordPolicy(input.newPassword)) {
      throw AppError.badRequest(
        "Password baru minimal 8 karakter dan wajib mengandung kombinasi huruf dan angka",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const newHashedPassword = await hashPassword(input.newPassword);
    await userRepository.updatePassword(userId, newHashedPassword, false);

    // Revoke all refresh tokens on password change (security requirement)
    await refreshTokenRepository.revokeAllUserTokens(userId);

    await writeAuditLog({
      actorId: userId,
      entity: "users",
      entityId: userId,
      action: "CHANGE_PASSWORD",
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: false },
    });
  }
}

export const authService = new AuthService();
