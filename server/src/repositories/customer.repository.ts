import { db } from "../db/client.js";
import { CUSTOMER_TAGS, type CustomerTag } from "../constants/index.js";

export interface CustomerEntity {
  id: string;
  name: string;
  phoneWa: string;
  socialMedia: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  recipientName: string | null;
  tag: CustomerTag;
  waOptIn: boolean;
  waOptInAt: Date | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerData {
  name: string;
  phoneWa: string;
  socialMedia?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  recipientName?: string | null;
  tag?: CustomerTag;
  waOptIn?: boolean;
  notes?: string | null;
}

export interface UpdateCustomerData {
  name?: string;
  phoneWa?: string;
  socialMedia?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  recipientName?: string | null;
  tag?: CustomerTag;
  waOptIn?: boolean;
  notes?: string | null;
}

export interface CustomerQueryFilter {
  q?: string;
  tag?: CustomerTag;
  waOptIn?: boolean;
  includeDeleted?: boolean;
  page?: number;
  limit?: number;
}

export class CustomerRepository {
  async findById(id: string, includeDeleted = false): Promise<CustomerEntity | null> {
    const customer = await db.customer.findUnique({
      where: { id },
    });
    if (!customer) return null;
    if (!includeDeleted && customer.deletedAt !== null) return null;

    return {
      ...customer,
      tag: customer.tag as CustomerTag,
    };
  }

  async findByPhoneWa(phoneWa: string, includeDeleted = false): Promise<CustomerEntity | null> {
    const customer = await db.customer.findUnique({
      where: { phoneWa },
    });
    if (!customer) return null;
    if (!includeDeleted && customer.deletedAt !== null) return null;

    return {
      ...customer,
      tag: customer.tag as CustomerTag,
    };
  }

  async findMany(filter: CustomerQueryFilter): Promise<{ customers: CustomerEntity[]; total: number }> {
    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (!filter.includeDeleted) {
      where.deletedAt = null;
    }

    if (filter.tag) {
      where.tag = filter.tag;
    }

    if (typeof filter.waOptIn === "boolean") {
      where.waOptIn = filter.waOptIn;
    }

    if (filter.q) {
      const q = filter.q.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phoneWa: { contains: q } },
      ];
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.customer.count({ where }),
    ]);

    return {
      customers: customers.map((c) => ({
        ...c,
        tag: c.tag as CustomerTag,
      })),
      total,
    };
  }

  async create(data: CreateCustomerData): Promise<CustomerEntity> {
    const customer = await db.customer.create({
      data: {
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
      },
    });

    return {
      ...customer,
      tag: customer.tag as CustomerTag,
    };
  }

  async update(id: string, data: UpdateCustomerData): Promise<CustomerEntity> {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.phoneWa !== undefined) updateData.phoneWa = data.phoneWa;
    if (data.socialMedia !== undefined) updateData.socialMedia = data.socialMedia;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.province !== undefined) updateData.province = data.province;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.recipientName !== undefined) updateData.recipientName = data.recipientName;
    if (data.tag !== undefined) updateData.tag = data.tag;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.waOptIn !== undefined) {
      updateData.waOptIn = data.waOptIn;
      if (data.waOptIn) {
        updateData.waOptInAt = new Date();
      }
    }

    const customer = await db.customer.update({
      where: { id },
      data: updateData,
    });

    return {
      ...customer,
      tag: customer.tag as CustomerTag,
    };
  }

  async softDelete(id: string): Promise<void> {
    await db.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const customerRepository = new CustomerRepository();
