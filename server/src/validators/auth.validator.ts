import { z } from "zod";
import { USER_ROLES } from "../constants/index.js";

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const passwordErrorMessage = "Password minimal 8 karakter dan wajib mengandung kombinasi huruf dan angka";

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.email("Format email tidak valid"),
  password: z.string().regex(passwordRegex, passwordErrorMessage),
  role: z.enum([USER_ROLES.OWNER, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE, USER_ROLES.SHOPPER]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Password lama wajib diisi"),
  newPassword: z.string().regex(passwordRegex, passwordErrorMessage),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token wajib disertakan"),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.email("Format email tidak valid"),
  role: z.enum([USER_ROLES.OWNER, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE, USER_ROLES.SHOPPER]).default(USER_ROLES.ADMIN),
  password: z.string().regex(passwordRegex, passwordErrorMessage).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").optional(),
  email: z.email("Format email tidak valid").optional(),
  role: z.enum([USER_ROLES.OWNER, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE, USER_ROLES.SHOPPER]).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().regex(passwordRegex, passwordErrorMessage).optional(),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
