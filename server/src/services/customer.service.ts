import {
  customerRepository,
  type CustomerEntity,
  type CustomerQueryFilter,
} from "../repositories/customer.repository.js";
import { AppError } from "../utils/error.js";
import { ERROR_CODES } from "../constants/index.js";
import { writeAuditLog } from "../utils/audit.js";
import type {
  CreateCustomerInput,
  QuickCreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customer.validator.js";

export class CustomerService {
  async listCustomers(filter: CustomerQueryFilter): Promise<{ customers: CustomerEntity[]; total: number }> {
    return customerRepository.findMany(filter);
  }

  async getCustomerById(id: string): Promise<CustomerEntity> {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw AppError.notFound("Customer tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }
    return customer;
  }

  async createCustomer(input: CreateCustomerInput, actorId?: string): Promise<CustomerEntity> {
    const existing = await customerRepository.findByPhoneWa(input.phoneWa);
    if (existing) {
      throw AppError.conflict("Nomor WhatsApp sudah terdaftar", ERROR_CODES.DUPLICATE_PHONE, {
        field: "phoneWa",
        issue: "duplicate",
      });
    }

    const customer = await customerRepository.create({
      name: input.name.trim(),
      phoneWa: input.phoneWa,
      socialMedia: input.socialMedia?.trim(),
      address: input.address?.trim(),
      city: input.city?.trim(),
      province: input.province?.trim(),
      postalCode: input.postalCode?.trim(),
      recipientName: input.recipientName?.trim(),
      tag: input.tag as any,
      waOptIn: input.waOptIn,
      notes: input.notes?.trim(),
    });

    await writeAuditLog({
      actorId,
      entity: "customers",
      entityId: customer.id,
      action: "CREATE_CUSTOMER",
      after: { name: customer.name, phoneWa: customer.phoneWa, tag: customer.tag },
    });

    return customer;
  }

  async quickCreateCustomer(input: QuickCreateCustomerInput, actorId?: string): Promise<CustomerEntity> {
    return this.createCustomer(
      {
        name: input.name,
        phoneWa: input.phoneWa,
        tag: input.tag,
        notes: input.notes,
        waOptIn: true,
      },
      actorId
    );
  }

  async updateCustomer(id: string, input: UpdateCustomerInput, actorId?: string): Promise<CustomerEntity> {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw AppError.notFound("Customer tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    if (input.phoneWa && input.phoneWa !== customer.phoneWa) {
      const existing = await customerRepository.findByPhoneWa(input.phoneWa);
      if (existing && existing.id !== id) {
        throw AppError.conflict("Nomor WhatsApp sudah terdaftar", ERROR_CODES.DUPLICATE_PHONE, {
          field: "phoneWa",
          issue: "duplicate",
        });
      }
    }

    const updated = await customerRepository.update(id, {
      name: input.name?.trim(),
      phoneWa: input.phoneWa,
      socialMedia: input.socialMedia?.trim(),
      address: input.address?.trim(),
      city: input.city?.trim(),
      province: input.province?.trim(),
      postalCode: input.postalCode?.trim(),
      recipientName: input.recipientName?.trim(),
      tag: input.tag as any,
      waOptIn: input.waOptIn,
      notes: input.notes?.trim(),
    });

    await writeAuditLog({
      actorId,
      entity: "customers",
      entityId: id,
      action: "UPDATE_CUSTOMER",
      before: { name: customer.name, phoneWa: customer.phoneWa, tag: customer.tag },
      after: { name: updated.name, phoneWa: updated.phoneWa, tag: updated.tag },
    });

    return updated;
  }

  async deleteCustomer(id: string, actorId?: string): Promise<void> {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw AppError.notFound("Customer tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    // Soft delete (CUS-8)
    await customerRepository.softDelete(id);

    await writeAuditLog({
      actorId,
      entity: "customers",
      entityId: id,
      action: "DELETE_CUSTOMER",
      before: { name: customer.name, phoneWa: customer.phoneWa },
    });
  }

  /**
   * Retrieves customer order history and balance summary (PRD CUS-4).
   */
  async getCustomerOrders(customerId: string): Promise<{
    orders: unknown[];
    totalSpent: number;
    unpaidAmount: number;
  }> {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw AppError.notFound("Customer tidak ditemukan", ERROR_CODES.NOT_FOUND);
    }

    // When order module is implemented, this will aggregate orders from order repository.
    return {
      orders: [],
      totalSpent: 0,
      unpaidAmount: 0,
    };
  }
}

export const customerService = new CustomerService();
