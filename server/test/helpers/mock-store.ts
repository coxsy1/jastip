import { userRepository, type UserEntity } from "../../src/repositories/user.repository.js";
import { refreshTokenRepository, type RefreshTokenEntity } from "../../src/repositories/refresh-token.repository.js";
import { customerRepository, type CustomerEntity } from "../../src/repositories/customer.repository.js";
import { hashPassword } from "../../src/utils/password.js";
import { USER_ROLES, CUSTOMER_TAGS } from "../../src/constants/index.js";

export async function setupInMemoryStore() {
  const users: Map<string, UserEntity> = new Map();
  const refreshTokens: Map<string, RefreshTokenEntity> = new Map();
  const customers: Map<string, CustomerEntity> = new Map();

  // Seed default accounts in memory
  const defaultPassword = await hashPassword("Password123!");

  const owner: UserEntity = {
    id: "user-owner-001",
    email: "owner@jastipops.com",
    name: "Owner JastipOps",
    password: defaultPassword,
    role: USER_ROLES.OWNER,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const admin: UserEntity = {
    id: "user-admin-001",
    email: "admin@jastipops.com",
    name: "Admin JastipOps",
    password: defaultPassword,
    role: USER_ROLES.ADMIN,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const warehouse: UserEntity = {
    id: "user-warehouse-001",
    email: "warehouse@jastipops.com",
    name: "Warehouse JastipOps",
    password: defaultPassword,
    role: USER_ROLES.WAREHOUSE,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.set(owner.id, owner);
  users.set(admin.id, admin);
  users.set(warehouse.id, warehouse);

  // 1. Mock UserRepository methods
  userRepository.findByEmail = async (email: string) => {
    for (const u of users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u };
      }
    }
    return null;
  };

  userRepository.findById = async (id: string) => {
    const u = users.get(id);
    return u ? { ...u } : null;
  };

  userRepository.create = async (data) => {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newUser: UserEntity = {
      id,
      email: data.email,
      name: data.name,
      password: data.password,
      role: (data.role ?? USER_ROLES.ADMIN) as any,
      isActive: true,
      mustChangePassword: data.mustChangePassword ?? false,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(id, newUser);
    return { ...newUser };
  };

  userRepository.update = async (id, data) => {
    const u = users.get(id);
    if (!u) throw new Error("User not found");
    const updated: UserEntity = {
      ...u,
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(data.role && { role: data.role as any }),
      ...(typeof data.isActive === "boolean" && { isActive: data.isActive }),
      ...(typeof data.mustChangePassword === "boolean" && { mustChangePassword: data.mustChangePassword }),
      ...(data.password && { password: data.password }),
      updatedAt: new Date(),
    };
    users.set(id, updated);
    return { ...updated };
  };

  userRepository.updateLastLogin = async (userId: string) => {
    const u = users.get(userId);
    if (u) {
      u.lastLoginAt = new Date();
    }
  };

  userRepository.updatePassword = async (userId: string, passwordHash: string, mustChangePassword = false) => {
    const u = users.get(userId);
    if (u) {
      u.password = passwordHash;
      u.mustChangePassword = mustChangePassword;
    }
  };

  userRepository.countActiveOwners = async () => {
    let count = 0;
    for (const u of users.values()) {
      if (u.role === USER_ROLES.OWNER && u.isActive) {
        count++;
      }
    }
    return count;
  };

  userRepository.findMany = async (filter) => {
    let list = Array.from(users.values());
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (filter.role) {
      list = list.filter((u) => u.role === filter.role);
    }
    if (typeof filter.isActive === "boolean") {
      list = list.filter((u) => u.isActive === filter.isActive);
    }
    const total = list.length;
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;
    return { users: list.slice(skip, skip + limit), total };
  };

  // 2. Mock RefreshTokenRepository
  refreshTokenRepository.create = async (input) => {
    const id = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const tokenHash = refreshTokenRepository.hashToken(input.token);
    const entity: RefreshTokenEntity = {
      id,
      userId: input.userId,
      tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
      createdAt: new Date(),
    };
    refreshTokens.set(tokenHash, entity);
    return { ...entity };
  };

  refreshTokenRepository.findByToken = async (token) => {
    const tokenHash = refreshTokenRepository.hashToken(token);
    const rt = refreshTokens.get(tokenHash);
    return rt ? { ...rt } : null;
  };

  refreshTokenRepository.revokeToken = async (id) => {
    for (const rt of refreshTokens.values()) {
      if (rt.id === id) {
        rt.revokedAt = new Date();
      }
    }
  };

  refreshTokenRepository.revokeAllUserTokens = async (userId) => {
    for (const rt of refreshTokens.values()) {
      if (rt.userId === userId) {
        rt.revokedAt = new Date();
      }
    }
  };

  // 3. Mock CustomerRepository
  customerRepository.findById = async (id: string, includeDeleted = false) => {
    const c = customers.get(id);
    if (!c) return null;
    if (!includeDeleted && c.deletedAt !== null) return null;
    return { ...c };
  };

  customerRepository.findByPhoneWa = async (phoneWa: string, includeDeleted = false) => {
    for (const c of customers.values()) {
      if (c.phoneWa === phoneWa) {
        if (!includeDeleted && c.deletedAt !== null) return null;
        return { ...c };
      }
    }
    return null;
  };

  customerRepository.findMany = async (filter) => {
    let list = Array.from(customers.values());
    if (!filter.includeDeleted) {
      list = list.filter((c) => c.deletedAt === null);
    }
    if (filter.tag) {
      list = list.filter((c) => c.tag === filter.tag);
    }
    if (typeof filter.waOptIn === "boolean") {
      list = list.filter((c) => c.waOptIn === filter.waOptIn);
    }
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phoneWa.includes(q));
    }
    const total = list.length;
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;
    return { customers: list.slice(skip, skip + limit), total };
  };

  customerRepository.create = async (data) => {
    const id = `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCust: CustomerEntity = {
      id,
      name: data.name,
      phoneWa: data.phoneWa,
      socialMedia: data.socialMedia ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      province: data.province ?? null,
      postalCode: data.postalCode ?? null,
      recipientName: data.recipientName ?? null,
      tag: (data.tag ?? CUSTOMER_TAGS.REGULAR) as any,
      waOptIn: data.waOptIn ?? true,
      waOptInAt: data.waOptIn !== false ? new Date() : null,
      notes: data.notes ?? null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    customers.set(id, newCust);
    return { ...newCust };
  };

  customerRepository.update = async (id, data) => {
    const c = customers.get(id);
    if (!c) throw new Error("Customer not found");
    const updated: CustomerEntity = {
      ...c,
      ...(data.name && { name: data.name }),
      ...(data.phoneWa && { phoneWa: data.phoneWa }),
      ...(data.socialMedia !== undefined && { socialMedia: data.socialMedia }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.province !== undefined && { province: data.province }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.recipientName !== undefined && { recipientName: data.recipientName }),
      ...(data.tag && { tag: data.tag as any }),
      ...(typeof data.waOptIn === "boolean" && { waOptIn: data.waOptIn }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date(),
    };
    customers.set(id, updated);
    return { ...updated };
  };

  customerRepository.softDelete = async (id: string) => {
    const c = customers.get(id);
    if (c) {
      c.deletedAt = new Date();
    }
  };

  return { users, refreshTokens, customers };
}
