# JastipOps Backend — Developer Documentation

> Versi dokumen: **1.2** · Terakhir diperbarui: **2026-11-20**
> Stack: **Node.js 22 · Hono 4 · TypeScript · Prisma 7 · PostgreSQL**

---

## Daftar Isi

1. [Arsitektur & Struktur Folder](#1-arsitektur--struktur-folder)
2. [Konfigurasi & Environment](#2-konfigurasi--environment)
3. [Database & Prisma](#3-database--prisma)
4. [Konstanta & Tipe Global](#4-konstanta--tipe-global)
5. [Utilities](#5-utilities)
6. [Middlewares](#6-middlewares)
7. [Validators](#7-validators)
8. [Repository Layer](#8-repository-layer)
9. [Service Layer](#9-service-layer)
10. [Controller Layer](#10-controller-layer)
11. [Routes & Endpoint Catalog](#11-routes--endpoint-catalog)
12. [Respons API — Format Standar](#12-respons-api--format-standar)
13. [Alur Autentikasi & Keamanan](#13-alur-autentikasi--keamanan)
14. [Pengujian Otomatis (Automated Testing)](#14-pengujian-otomatis-automated-testing)

---

## 1. Arsitektur & Struktur Folder

```
jastip/
├── server/                        ← Backend (Node.js + Hono)
│   ├── prisma/
│   │   ├── schema.prisma          ← Model DB (User, RefreshToken, AuditLog, Customer)
│   │   ├── seed.ts                ← Seed data awal (Owner, Admin, Warehouse)
│   │   └── migrations/            ← File SQL migrasi
│   ├── src/
│   │   ├── app.ts                 ← Hono app instance + global middleware & error handler
│   │   ├── index.ts               ← Entry point (node-server)
│   │   ├── config/
│   │   │   └── index.ts           ← Config loader (YAML + .env + Zod fail-fast)
│   │   ├── constants/
│   │   │   └── index.ts           ← USER_ROLES, CUSTOMER_TAGS, HTTP_STATUS, ERROR_CODES
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts     ← Handler HTTP Auth
│   │   │   ├── user.controller.ts     ← Handler HTTP User Management
│   │   │   └── customer.controller.ts ← Handler HTTP Customer CRM
│   │   ├── db/
│   │   │   └── client.ts          ← Singleton Prisma client (@prisma/adapter-pg)
│   │   ├── middlewares/
│   │   │   ├── api-key.middleware.ts  ← Validasi x-api-key timingSafeEqual
│   │   │   ├── auth.middleware.ts     ← authenticate (JWT) & authorize (RBAC)
│   │   │   └── index.ts
│   │   ├── repositories/
│   │   │   ├── user.repository.ts          ← Data access User
│   │   │   ├── refresh-token.repository.ts ← Data access Multi-device Refresh Tokens
│   │   │   └── customer.repository.ts      ← Data access Customer (Soft Delete)
│   │   ├── routes/
│   │   │   ├── index.ts           ← /health probe + modular router mount
│   │   │   ├── auth.routes.ts     ← Route autentikasi (/auth)
│   │   │   ├── user.routes.ts     ← Route user management (/users)
│   │   │   └── customer.routes.ts ← Route customer CRM (/customers)
│   │   ├── services/
│   │   │   ├── auth.service.ts     ← Business logic autentikasi & token rotation
│   │   │   ├── user.service.ts     ← Business logic user CRUD & LAST_OWNER_PROTECTED
│   │   │   └── customer.service.ts ← Business logic customer CRM & duplicate detection
│   │   ├── utils/
│   │   │   ├── error.ts           ← AppError class & factories
│   │   │   ├── jwt.ts             ← Generate & verify JWT (dengan jti unique nonce)
│   │   │   ├── password.ts        ← Hash, compare, anti-timing dummy, password policy
│   │   │   ├── phone.ts           ← Normalisasi WA ke format 628... (CUS-1, AC7)
│   │   │   ├── rate-limiter.ts    ← InMemoryRateLimiter sliding window (AUTH-4)
│   │   │   ├── sanitizer.ts       ← sanitizeForRole (D14, AC1, AC2)
│   │   │   ├── pagination.ts      ← Pagination helpers (D17)
│   │   │   ├── audit.ts           ← writeAuditLog (D13)
│   │   │   ├── response.ts        ← JsonResponse class
│   │   │   └── index.ts
│   │   └── validators/
│   │       ├── auth.validator.ts     ← Zod schema auth & user
│   │       └── customer.validator.ts ← Zod schema customer & WA transform
│   ├── test/                      ← Test Suite (45 automated tests)
│   │   ├── helpers/
│   │   │   └── mock-store.ts      ← In-memory test repository harness
│   │   ├── unit/
│   │   │   └── utils.test.ts      ← Unit tests utilitas
│   │   └── integration/
│   │       ├── auth-user.test.ts  ← End-to-end integration auth & user
│   │       ├── customer.test.ts   ← End-to-end integration customer CRM
│   │       └── health.test.ts     ← Health check probe test
│   ├── config.yaml
│   ├── .env / .env.example
│   ├── prisma7.config.ts
│   ├── package.json
│   └── tsconfig.json
├── TODO.md                        ← Roadmap & checklist PRD v1.1
└── DOCUMENTATION.md               ← File ini
```

---

## 2. Konfigurasi & Environment

### File: `src/config/index.ts`
Loader terintegrasi YAML + `.env` + Zod fail-fast:
```typescript
import { config } from "./src/config/index.js";

config.server.port           // 3000
config.db.url                // postgresql://...
config.auth.jwtAccessSecret  // secret access token
config.auth.jwtRefreshSecret // secret refresh token
config.auth.bcryptSaltRounds // 12
config.security.apiKey       // x-api-key secret
```

---

## 3. Database & Prisma

### Model Terdaftar di `prisma/schema.prisma`:
1. **`User`**:
   - `id`: UUID (PK)
   - `email`: String (unik, lowercase)
   - `name`: String
   - `password`: String (bcrypt hash)
   - `role`: Enum `Role` (`OWNER`, `ADMIN`, `WAREHOUSE`, `SHOPPER`)
   - `isActive`: Boolean (`true`)
   - `mustChangePassword`: Boolean (`false`)
   - `lastLoginAt`: DateTime?
2. **`RefreshToken`**:
   - `id`: UUID (PK)
   - `userId`: String (FK ke `User`, cascade delete)
   - `tokenHash`: String (SHA-256 hash unik)
   - `expiresAt`: DateTime
   - `revokedAt`: DateTime?
   - `userAgent`: String?
   - `ip`: String?
3. **`AuditLog`**:
   - `id`: UUID (PK)
   - `actorId`: String? (FK ke `User`)
   - `entity`: String
   - `entityId`: String
   - `action`: String
   - `before`: JSONB?
   - `after`: JSONB?
4. **`Customer`**:
   - `id`: UUID (PK)
   - `name`: String
   - `phoneWa`: String (unik, format standar `628...`)
   - `socialMedia`: String?
   - `address`: String?
   - `city`: String?
   - `province`: String?
   - `postalCode`: String?
   - `recipientName`: String?
   - `tag`: Enum `CustomerTag` (`REGULAR`, `VIP`, `WARNING`)
   - `waOptIn`: Boolean (`true`)
   - `waOptInAt`: DateTime?
   - `notes`: String?
   - `deletedAt`: DateTime? (soft delete)

---

## 4. Konstanta & Tipe Global

### File: `src/constants/index.ts`
- **`USER_ROLES`**: `OWNER`, `ADMIN`, `WAREHOUSE`, `SHOPPER` (legacy alias).
- **`CUSTOMER_TAGS`**: `REGULAR`, `VIP`, `WARNING` (neutral UI labels).
- **`ERROR_CODES`**:
  `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `DUPLICATE_PHONE`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `USER_INACTIVE`, `PASSWORD_CHANGE_REQUIRED`, `LAST_OWNER_PROTECTED`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## 5. Utilities

| File | Utilitas Utama | Fungsi & Kepatuhan PRD |
|---|---|---|
| `src/utils/phone.ts` | `normalizePhoneWa(raw)` | Normalisasi WA ke format internasional `628...`, tolak non-seluler atau panjang abnormal (`CUS-1`, `AC7`, `AC18`). |
| `src/utils/password.ts` | `hashPassword`, `comparePassword`, `comparePasswordDummy`, `validatePasswordPolicy` | Hash bcrypt (cost 12), verifikasi anti-timing attack bila user tidak ada, dan validasi minimal 8 karakter dengan huruf & angka (`AUTH-5`). |
| `src/utils/rate-limiter.ts` | `InMemoryRateLimiter`, `loginRateLimiter` | Sliding window in-memory limiter: maksimal 5 gagal / 15 menit per kombinasi IP + Email (`AUTH-4`). |
| `src/utils/sanitizer.ts` | `sanitizeForRole(role, data)` | Menghapus rekursif field modal/profit untuk non-Owner, dan menyembunyikan data pribadi pelanggan & harga IDR untuk Warehouse (`D14`, `AC1`, `AC2`). |
| `src/utils/pagination.ts` | `parsePaginationParams`, `buildPaginationMeta` | Parsing standar `page` & `limit` (default 20, max 100), kalkulasi `skip` (`D17`). |
| `src/utils/audit.ts` | `writeAuditLog(input)` | Mencatat jejak audit ke tabel `audit_logs` (`D13`). |
| `src/utils/error.ts` | `AppError` | Kelas error terstandarisasi dengan `statusCode`, `code`, dan `details`. |
| `src/utils/response.ts` | `JsonResponse` | Handler respons JSON seragam (`success`, `created`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`, `serviceUnavailable`, `internalServerError`). |

---

## 6. Middlewares

1. **`apiKeyMiddleware`**:
   - Memvalidasi header `x-api-key` menggunakan perbandingan konstan `crypto.timingSafeEqual`.
2. **`authenticate`**:
   - Memvalidasi JWT Bearer token.
   - Mengambil status user terbaru dari DB. Jika akun dinonaktifkan (`isActive === false`), otomatis ditolak `403 USER_INACTIVE` (`AC11`).
   - Jika `mustChangePassword === true`, memblokir akses ke rute operasional selain `/auth/me`, `/auth/me/password`, dan `/auth/logout` dengan `403 PASSWORD_CHANGE_REQUIRED`.
3. **`authorize(...roles)`**:
   - Memeriksa hak akses peran (RBAC). Menolak akses peran yang tidak berhak dengan `403 FORBIDDEN` (`AC1`, `AC2`).

---

## 7. Validators (Zod)

- **Auth & User**:
  - `loginSchema`: validasi email & password tidak kosong.
  - `registerSchema`: validasi password minimal 8 huruf + angka.
  - `changePasswordSchema`: oldPassword + newPassword (sesuai policy).
  - `createUserSchema`: nama, email, role, password awal opsional.
  - `updateUserSchema`: nama, email, role.
  - `updateUserStatusSchema`: `isActive` boolean.
- **Customer CRM**:
  - `createCustomerSchema`: validasi nama (min 2), nomor WhatsApp ditransformasi otomatis via `normalizePhoneWa`, tag enum, dll.
  - `quickCreateCustomerSchema`: input cepat nama + WhatsApp saja (`CUS-5`).
  - `updateCustomerSchema`: opsi pembaruan data parsial.

---

## 8. Repository Layer

1. **`userRepository`**:
   - `findByEmail`, `findById`, `findMany` (filter & paginasi), `create`, `update`, `updateLastLogin`, `updatePassword`, `updateStatus`, `countActiveOwners`.
2. **`refreshTokenRepository`**:
   - `create`: simpan token ter-hash SHA-256 dengan expiration.
   - `findByToken`: pencarian berbasis hash token.
   - `revokeToken`: mencatat `revokedAt`.
   - `revokeAllUserTokens`: mencabut semua sesi user aktif (dipakai saat logout, ganti password, atau deteksi token reuse).
3. **`customerRepository`**:
   - `create`, `findById`, `findByPhoneWa`, `findMany` (soft delete filter otomatis), `update`, `softDelete`.

---

## 9. Service Layer

1. **`authService`**:
   - `login`: anti user-enumeration dummy hash, update `lastLoginAt`, multi-device token storage, audit log.
   - `refreshToken`: rotasi token (revoke token lama, terbitkan pasangan token baru). Bila token lama terdeteksi dipakai ulang, membatalkan seluruh token aktif pengguna tersebut (*Token Reuse Detection / Family Invalidation*).
   - `changePassword`: verifikasi password lama, enforce password policy, update DB, revoke seluruh sesi refresh token lama.
   - `logout`: revoke refresh token spesifik atau semua token user.
2. **`userService`**:
   - `listUsers`: paginasi dan filter user.
   - `createUser`: generate password awal acak bila tidak diisi, set `mustChangePassword = true` (`USR-1`).
   - `updateUser`: update profil dan role dengan proteksi `LAST_OWNER_PROTECTED` (Owner terakhir tidak boleh diturunkan role-nya).
   - `toggleStatus`: aktivasi/nonaktivasi user dengan proteksi `LAST_OWNER_PROTECTED` (Owner terakhir tidak boleh dinonaktifkan).
   - `resetPassword`: set temporary password baru, set `mustChangePassword = true`, revoke seluruh sesi aktif.
3. **`customerService`**:
   - `listCustomers`: daftar pelanggan dengan filter & pencarian trigram/partial.
   - `createCustomer`: normalisasi nomor WhatsApp, deteksi duplikasi unik nomor WA (`409 DUPLICATE_PHONE`).
   - `quickCreateCustomer`: tambah cepat customer nama + WA (`CUS-5`).
   - `updateCustomer`: pembaruan data dan verifikasi duplikat nomor WA bila nomor diubah.
   - `deleteCustomer`: soft-delete customer (`deletedAt = now()`) (`CUS-8`).
   - `getCustomerOrders`: riwayat transaksi dan total sisa tagihan (`CUS-4`).

---

## 10. Controller Layer

1. **`authController`**:
   - Menangani `/auth/login` (termasuk pengecekan rate limiter 5 percobaan gagal per 15 menit), `/auth/register`, `/auth/me`, `/auth/me/password`, `/auth/refresh`, `/auth/logout`.
2. **`userController`**:
   - Menangani list, create, detail, update, toggle status, reset password.
3. **`customerController`**:
   - Menangani list, create, quickCreate, detail, update, soft-delete, customer orders. Melakukan sanitasi field modal/pribadi berdasarkan role pemanggil (`sanitizeForRole`).

---

## 11. Routes & Endpoint Catalog

Semua rute diawali prefix `/api/v1` dan diproteksi header `x-api-key`.

| Method | Endpoint | Hak Akses (Role) | Keterangan |
|---|---|---|---|
| `GET` | `/health` | Publik | Health probe & DB connectivity check (`SELECT 1`) |
| `POST` | `/auth/login` | Publik | Login pengguna (rate limited: 5 gagal/15 menit) |
| `POST` | `/auth/register` | Publik / Owner | Registrasi akun awal |
| `POST` | `/auth/refresh` | Publik | Rotasi token (dukung multi-device & reuse detection) |
| `GET` | `/auth/me` | Terautentikasi | Profil pengguna saat ini |
| `PATCH` | `/auth/me/password` | Terautentikasi | Ganti password mandiri (set mustChangePassword=false) |
| `POST` | `/auth/logout` | Terautentikasi | Invalidate sesi refresh token |
| `GET` | `/users` | `OWNER` | Daftar pengguna dengan filter & paginasi |
| `POST` | `/users` | `OWNER` | Pembuatan user oleh Owner (`mustChangePassword=true`) |
| `GET` | `/users/:id` | `OWNER` | Detail data user |
| `PATCH` | `/users/:id` | `OWNER` | Update nama/role user (`LAST_OWNER_PROTECTED`) |
| `PATCH` | `/users/:id/status` | `OWNER` | Aktif/nonaktifkan user (`LAST_OWNER_PROTECTED`) |
| `POST` | `/users/:id/reset-password` | `OWNER` | Reset password user oleh Owner |
| `GET` | `/customers` | `OWNER`, `ADMIN` | Daftar customer (Warehouse ditolak `403`) |
| `POST` | `/customers` | `OWNER`, `ADMIN` | Tambah data lengkap customer |
| `POST` | `/customers/quick` | `OWNER`, `ADMIN` | Tambah cepat customer (nama + WA saja) |
| `GET` | `/customers/:id` | `OWNER`, `ADMIN` | Detail data customer |
| `PATCH` | `/customers/:id` | `OWNER`, `ADMIN` | Pembaruan data customer |
| `DELETE` | `/customers/:id` | `OWNER`, `ADMIN` | Soft-delete customer |
| `GET` | `/customers/:id/orders` | `OWNER`, `ADMIN` | Riwayat pesanan & sisa tagihan customer |

---

## 12. Respons API — Format Standar

### Sukses (200 / 201)
```json
{
  "success": true,
  "message": "Operasi berhasil",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_PHONE",
    "message": "Nomor WhatsApp sudah terdaftar",
    "details": { "field": "phoneWa", "issue": "duplicate" }
  }
}
```

---

## 13. Alur Autentikasi & Keamanan

### Proteksi Keamanan yang Ditegakkan:
1. **Timing Attack & User Enumeration**: Bila email login tidak ditemukan, sistem tetap menjalankan komparasi bcrypt dummy untuk mencegah kebocoran waktu respon.
2. **Brute-Force Rate Limiting**: Batas maksimal 5 percobaan gagal per 15 menit per kombinasi IP + Email. Percobaan berikutnya langsung dibalas `429 RATE_LIMITED`.
3. **Multi-device Session & Refresh Token Rotation**: Setiap pemakaian refresh token akan membatalkan token tersebut dan menerbitkan token baru dengan `jti` unik. Jika token yang sudah dibatalkan dicoba kembali, sistem mendeteksi sebagai pencurian token (*token reuse*) dan otomatis mencabut seluruh sesi pengguna tersebut.
4. **Proteksi Akun Nonaktif (`AC11`)**: Setiap request ke protected route memeriksa status `isActive` ke database. Akun nonaktif langsung diblokir `403 USER_INACTIVE`.
5. **Kebijakan Ganti Password Pertama Kali (`AUTH-3`, `USR-1`)**: User yang dibuat oleh Owner memiliki flag `mustChangePassword: true`. User ini tidak diizinkan mengakses resource lain sebelum mengubah passwordnya melalui `PATCH /auth/me/password`.
6. **Proteksi Owner Terakhir (`LAST_OWNER_PROTECTED`, `USR-4`)**: Owner terakhir yang aktif dilarang dinonaktifkan atau diturunkan role-nya guna mencegah sistem terkunci tanpa pengelola.

---

## 14. Pengujian Otomatis (Automated Testing)

Seluruh logika bisnis, utilitas, proteksi RBAC, dan skenario edge cases diuji melalui test runner terintegrasi Node.js 22 + TypeScript tanpa dependensi eksternal.

### Menjalankan Seluruh Test Suite:
```bash
cd server
npm test
```

### Ringkasan Cakupan Test Suite (45 Tests):
- **Unit Tests (`test/unit/utils.test.ts`) — 19 Tests**:
  - Normalisasi nomor WhatsApp (`08...`, `+628...`, `8...`, karakter khusus, tolak non-seluler, tolak panjang tidak wajar).
  - Validasi kebijakan password (minimal 8 karakter kombinasi huruf dan angka).
  - Sliding-window rate limiter (blokir di percobaan ke-5, reset pada sukses).
  - Sanitasi data per role (`OWNER` vs `ADMIN` vs `WAREHOUSE`).
  - Helper paginasi & kalkulasi metadata.
- **Integration Tests Tahap 1 (`test/integration/auth-user.test.ts`) — 13 Tests**:
  - Proteksi trafik `x-api-key` (missing / invalid key).
  - Alur login kredensial salah & trigger rate limiter 429.
  - Alur login sukses & pembatasan akses data password.
  - Autentikasi JWT Bearer token pada profil `GET /auth/me`.
  - Rotasi refresh token dan pendeteksian reuse token lama.
  - Perubahan password mandiri `PATCH /auth/me/password`.
  - Penolakan akses role Admin & Warehouse ke rute `/users` (403 Forbidden).
  - Pembuatan user baru oleh Owner dengan `mustChangePassword = true`.
  - Penegakan proteksi `LAST_OWNER_PROTECTED` saat deaktivasi Owner terakhir.
- **Integration Tests Tahap 2 (`test/integration/customer.test.ts`) — 12 Tests**:
  - RBAC customer: Warehouse ditolak 403, Admin & Owner diizinkan.
  - Pembuatan customer lengkap dengan normalisasi otomatis nomor WA.
  - Tambah cepat customer (hanya nama + WA).
  - Penolakan duplikasi nomor WhatsApp (409 DUPLICATE_PHONE).
  - Pencarian customer parsial berdasarkan nama dan nomor WA.
  - Filter customer berdasarkan label tag (`REGULAR`, `VIP`, `WARNING`).
  - Pembaruan data customer.
  - Pengambilan riwayat transaksi & sisa tagihan.
  - Soft-delete customer dan verifikasi data tidak lagi muncul di pencarian aktif.
- **Health Check Probe (`test/integration/health.test.ts`) — 1 Test**:
  - Pengecekan respons probe kesiapan server dan database ping.
