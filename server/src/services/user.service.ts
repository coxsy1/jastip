import crypto from "node:crypto";
import { userRepository, type UserEntity, type UserQueryFilter } from "../repositories/user.repository.js";
import { refreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { hashPassword, validatePasswordPolicy } from "../utils/password.js";
import { AppError } from "../utils/error.js";
import { ERROR_CODES, USER_ROLES, type UserRole } from "../constants/index.js";
import { writeAuditLog } from "../utils/audit.js";
import type { CreateUserInput, UpdateUserInput } from "../validators/auth.validator.js";

function generateSecureRandomPassword(): string {
  // Generates e.g. "Abc123!xyz" guaranteed to meet letters+numbers policy
  const randomChars = crypto.randomBytes(6).toString("base64").replace(/[+/=]/g, "a");
  return `Jastip${randomChars}1!`;
}

function sanitizeUser(user: UserEntity): Omit<UserEntity, "password" | "refreshToken"> {
  const { password: _p, refreshToken: _rt, ...safeUser } = user;
  return safeUser;
}

export class UserService {
  async listUsers(filter: UserQueryFilter): Promise<{ users: Omit<UserEntity, "password" | "refreshToken">[]; total: number }> {
    const { users, total } = await userRepository.findMany(filter);
    return {
      users: users.map(sanitizeUser),
      total,
    };
  }

  async getUserById(id: string): Promise<Omit<UserEntity, "password" | "refreshToken">> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound("User tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }
    return sanitizeUser(user);
  }

  async createUser(input: CreateUserInput, actorId?: string): Promise<{ user: Omit<UserEntity, "password" | "refreshToken">; initialPassword: string }> {
    const email = input.email.toLowerCase().trim();

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict("Email sudah terdaftar", ERROR_CODES.CONFLICT);
    }

    const initialPassword = input.password || generateSecureRandomPassword();

    if (!validatePasswordPolicy(initialPassword)) {
      throw AppError.badRequest(
        "Password minimal 8 karakter dan wajib mengandung kombinasi huruf dan angka",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const hashedPassword = await hashPassword(initialPassword);

    const user = await userRepository.create({
      name: input.name.trim(),
      email,
      role: input.role as UserRole,
      password: hashedPassword,
      mustChangePassword: true, // PRD USR-1: wajib ganti password saat login pertama
    });

    await writeAuditLog({
      actorId,
      entity: "users",
      entityId: user.id,
      action: "CREATE_USER",
      after: { email: user.email, name: user.name, role: user.role },
    });

    return {
      user: sanitizeUser(user),
      initialPassword,
    };
  }

  async updateUser(id: string, input: UpdateUserInput, actorId?: string): Promise<Omit<UserEntity, "password" | "refreshToken">> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound("User tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    // Protection rule: LAST_OWNER_PROTECTED
    if (user.role === USER_ROLES.OWNER && input.role && input.role !== USER_ROLES.OWNER) {
      const activeOwnersCount = await userRepository.countActiveOwners();
      if (activeOwnersCount <= 1) {
        throw AppError.badRequest(
          "Owner terakhir tidak bisa diturunkan role-nya",
          ERROR_CODES.LAST_OWNER_PROTECTED
        );
      }
    }

    // Check email uniqueness if changing email
    if (input.email && input.email.toLowerCase().trim() !== user.email) {
      const existing = await userRepository.findByEmail(input.email.toLowerCase().trim());
      if (existing && existing.id !== id) {
        throw AppError.conflict("Email sudah digunakan oleh akun lain", ERROR_CODES.CONFLICT);
      }
    }

    const updated = await userRepository.update(id, {
      name: input.name?.trim(),
      email: input.email?.toLowerCase().trim(),
      role: input.role as UserRole,
    });

    await writeAuditLog({
      actorId,
      entity: "users",
      entityId: id,
      action: "UPDATE_USER",
      before: { name: user.name, email: user.email, role: user.role },
      after: { name: updated.name, email: updated.email, role: updated.role },
    });

    return sanitizeUser(updated);
  }

  async toggleStatus(id: string, isActive: boolean, actorId?: string): Promise<Omit<UserEntity, "password" | "refreshToken">> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound("User tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    // Protection rule: LAST_OWNER_PROTECTED
    if (user.role === USER_ROLES.OWNER && !isActive) {
      const activeOwnersCount = await userRepository.countActiveOwners();
      if (activeOwnersCount <= 1) {
        throw AppError.badRequest(
          "Owner terakhir tidak bisa dinonaktifkan",
          ERROR_CODES.LAST_OWNER_PROTECTED
        );
      }
    }

    const updated = await userRepository.update(id, { isActive });

    // If deactivated, revoke all active tokens immediately
    if (!isActive) {
      await refreshTokenRepository.revokeAllUserTokens(id);
    }

    await writeAuditLog({
      actorId,
      entity: "users",
      entityId: id,
      action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      before: { isActive: user.isActive },
      after: { isActive },
    });

    return sanitizeUser(updated);
  }

  async resetPassword(id: string, newPassword?: string, actorId?: string): Promise<{ temporaryPassword: string }> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw AppError.notFound("User tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    const tempPassword = newPassword || generateSecureRandomPassword();

    if (!validatePasswordPolicy(tempPassword)) {
      throw AppError.badRequest(
        "Password minimal 8 karakter dan wajib mengandung kombinasi huruf dan angka",
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const hashedPassword = await hashPassword(tempPassword);
    await userRepository.updatePassword(id, hashedPassword, true);

    // Revoke all existing sessions
    await refreshTokenRepository.revokeAllUserTokens(id);

    await writeAuditLog({
      actorId,
      entity: "users",
      entityId: id,
      action: "RESET_PASSWORD",
      after: { mustChangePassword: true },
    });

    return { temporaryPassword: tempPassword };
  }
}

export const userService = new UserService();
