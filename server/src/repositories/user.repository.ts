import { db } from "../db/client.js";
import { USER_ROLES, type UserRole } from "../constants/index.js";

export interface UserEntity {
  id: string;
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  refreshToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  mustChangePassword?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  password?: string;
}

export interface UserQueryFilter {
  q?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export class UserRepository {
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return null;
    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  async findMany(filter: UserQueryFilter): Promise<{ users: UserEntity[]; total: number }> {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter.q) {
      const q = filter.q.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    if (filter.role) {
      where.role = filter.role;
    }

    if (typeof filter.isActive === "boolean") {
      where.isActive = filter.isActive;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        role: u.role as UserRole,
      })),
      total,
    };
  }

  async create(data: CreateUserData): Promise<UserEntity> {
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: data.password,
        role: (data.role ?? USER_ROLES.ADMIN) as any,
        isActive: true,
        mustChangePassword: data.mustChangePassword ?? false,
      },
    });
    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity> {
    const user = await db.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.role && { role: data.role as any }),
        ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
        ...(typeof data.mustChangePassword === "boolean" && { mustChangePassword: data.mustChangePassword }),
        ...(data.password && { password: data.password }),
      },
    });
    return {
      ...user,
      role: user.role as UserRole,
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async updatePassword(userId: string, passwordHash: string, mustChangePassword: boolean = false): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        mustChangePassword,
      },
    });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  async updateStatus(userId: string, isActive: boolean): Promise<void> {
    await db.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async countActiveOwners(): Promise<number> {
    return db.user.count({
      where: {
        role: USER_ROLES.OWNER,
        isActive: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
