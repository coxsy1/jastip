# JastipOps API Connection & Integration Guide (Frontend / Client)

> Panduan integrasi teknis untuk menghubungkan aplikasi client (React / Mobile / API Consumer) dengan backend **JastipOps REST API**.  
> Versi Dokumen: **1.0** · Sesuai Spesifikasi: **PRD v1.1 (Tahap 1 & Tahap 2)**

---

## Daftar Isi

1. [Spesifikasi Dasar & Base URL](#1-spesifikasi-dasar--base-url)
2. [Header Wajib & Protokol Keamanan](#2-header-wajib--protokol-keamanan)
3. [Format Standar Respons API](#3-format-standar-respons-api)
4. [Siklus Autentikasi & Auto-Refresh Token](#4-siklus-autentikasi--auto-refresh-token)
5. [Client Integration (Axios Interceptor Siap Pakai)](#5-client-integration-axios-interceptor-siap-pakai)
6. [Katalog Endpoint & Dokumentasi Lengkap](#6-katalog-endpoint--dokumentasi-lengkap)
   - [6.1 Sistem & Health Check](#61-sistem--health-check)
   - [6.2 Modul 1A: Autentikasi (`/auth`)](#62-modul-1a-autentikasi-auth)
   - [6.3 Modul 1B: Manajemen User — Owner Only (`/users`)](#63-modul-1b-manajemen-user--owner-only-users)
   - [6.4 Modul 2: Customer / CRM (`/customers`)](#64-modul-2-customer--crm-customers)
7. [Katalog Kode Error Standar (`error.code`)](#7-katalog-kode-error-standar-errorcode)
8. [Matriks RBAC & Aturan Sanitasi Data](#8-matriks-rbac--aturan-sanitasi-data)

---

## 1. Spesifikasi Dasar & Base URL

| Lingkungan (Environment) | Base URL | Prefix API |
|---|---|---|
| **Local Development** | `http://localhost:3000` | `/api/v1` |
| **Staging** | `https://staging-api.jastipops.com` | `/api/v1` |
| **Production** | `https://api.jastipops.com` | `/api/v1` |

- **Protokol:** HTTP/HTTPS (HTTPS wajib di staging/production)
- **Format Payload:** `application/json`
- **Konvensi Penamaan:** `camelCase` untuk properti JSON
- **Format Tanggal/Waktu:** ISO 8601 UTC (`2026-11-20T12:00:00.000Z`)
- **Satuan Uang:** Integer Rupiah tanpa desimal (`150000` = Rp 150.000)

---

## 2. Header Wajib & Protokol Keamanan

Setiap request yang dikirim ke backend harus menyertakan header berikut:

```http
Content-Type: application/json
x-api-key: jastipops-secure-api-key-2026
Authorization: Bearer <accessToken>
```

### Rincian Header:

1. **`x-api-key` (Wajib di SEMUA Request):**
   - Kunci verifikasi gerbang trafik (*traffic gatekeeper*).
   - Nilai default lokal: `jastipops-secure-api-key-2026` (diambil dari environment client).
   - Bila tidak disertakan: mengembalikan `401 MISSING_API_KEY`.
   - Bila salah: mengembalikan `401 INVALID_API_KEY`.
2. **`Authorization` (Wajib di Protected Routes):**
   - Format: `Bearer <accessToken>`
   - Masa berlaku access token: **15 menit**.
   - Bila token expired atau tidak valid: mengembalikan `401 TOKEN_EXPIRED` atau `401 UNAUTHENTICATED`.

---

## 3. Format Standar Respons API

Seluruh respons dari server selalu menggunakan amplop (*envelope*) seragam:

### 3.1 Respons Sukses (HTTP 200 / 201)

```json
{
  "success": true,
  "message": "Operasi berhasil dijalankan",
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
> *Catatan: Objek `meta` otomatis disertakan pada endpoint yang mendukung paginasi (daftar list).*

### 3.2 Respons Error (HTTP 4xx / 5xx)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi input gagal",
    "details": [
      {
        "path": ["email"],
        "message": "Format email tidak valid"
      }
    ]
  }
}
```

---

## 4. Siklus Autentikasi & Auto-Refresh Token

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ALUR ROTASI TOKEN                                │
│                                                                        │
│  1. Login → Terima { accessToken (15m), refreshToken (7d) }            │
│  2. Simpan accessToken di memory state, refreshToken di storage/cookie │
│  3. Request API memakai header Authorization: Bearer <accessToken>     │
│  4. Jika API mengembalikan 401 TOKEN_EXPIRED:                          │
│     ├─ Kirim POST /api/v1/auth/refresh { refreshToken }                │
│     ├─ Terima { accessToken: baru, refreshToken: baru } (Rotasi)       │
│     └─ Ulangi request yang sempat gagal tadi dengan token baru         │
│  5. Jika Refresh Token ditolak: Logout & arahkan ke halaman Login      │
└────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **Token Reuse Detection:** Setiap refresh token hanya dapat digunakan **tepat 1 kali**. Saat endpoint `/auth/refresh` dipanggil, refresh token lama langsung dibatalkan (*revoked*) dan pasangan token baru diterbitkan. Jika token yang sudah dibatalkan dikirim ulang (indikasi pembajakan sesi), server akan **mencabut seluruh sesi pengguna tersebut demi keamanan**.

---

## 5. Client Integration (Axios Interceptor Siap Pakai)

Berikut adalah kode interceptor produksi untuk aplikasi frontend (React / Vite):

```typescript
// src/api/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const API_KEY = import.meta.env.VITE_API_KEY || "jastipops-secure-api-key-2026";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
  },
});

// State in-memory untuk access token
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem("refreshToken", token);
  } else {
    localStorage.removeItem("refreshToken");
  }
}

// 1. Request Interceptor: Otomatis menyematkan token Bearer
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (currentAccessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

// 2. Response Interceptor: Otomatis me-refresh token jika expired
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Cek jika error 401 dan bukan dari endpoint auth itu sendiri
    if (
      error.response?.status === 401 &&
      error.response?.data?.error?.code === "TOKEN_EXPIRED" &&
      !originalRequest.url?.includes("/auth/") &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setAccessToken(null);
        setRefreshToken(null);
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { headers: { "x-api-key": API_KEY } }
        );

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(new Error("Refresh token failed"), null);
        setAccessToken(null);
        setRefreshToken(null);
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 6. Katalog Endpoint & Dokumentasi Lengkap

### 6.1 Sistem & Health Check

#### `GET /health`
Mengecek status kesiapan server dan konektivitas database (`SELECT 1`).
- **Autentikasi:** Tidak butuh token / x-api-key.
- **Respons (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-11-20T12:00:00.000Z"
  }
}
```

---

### 6.2 Modul 1A: Autentikasi (`/auth`)

#### 1. `POST /auth/login`
Autentikasi akun pengguna dengan proteksi rate limit (5 kali gagal / 15 menit) dan anti-enumeration.
- **Headers:** `x-api-key`
- **Request Body:**
```json
{
  "email": "owner@jastipops.com",
  "password": "Password123!"
}
```
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "user": {
      "id": "user-uuid-123",
      "email": "owner@jastipops.com",
      "name": "Owner JastipOps",
      "role": "OWNER",
      "isActive": true,
      "mustChangePassword": false,
      "lastLoginAt": "2026-11-20T12:00:00.000Z",
      "createdAt": "2026-11-20T00:00:00.000Z",
      "updatedAt": "2026-11-20T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  }
}
```
- **Respons Terlalu Banyak Percobaan (429 Too Many Requests):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Terlalu banyak percobaan login gagal. Silakan coba lagi dalam 15 menit.",
    "details": { "retryAfterMs": 900000 }
  }
}
```

---

#### 2. `POST /auth/refresh`
Menukar refresh token dengan pasangan access token & refresh token baru (rotasi).
- **Headers:** `x-api-key`
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Token berhasil diperbarui",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

---

#### 3. `GET /auth/me`
Mengambil data profil pengguna yang sedang login.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Profil berhasil diambil",
  "data": {
    "id": "user-uuid-123",
    "email": "owner@jastipops.com",
    "name": "Owner JastipOps",
    "role": "OWNER",
    "isActive": true,
    "mustChangePassword": false,
    "lastLoginAt": "2026-11-20T12:00:00.000Z"
  }
}
```

---

#### 4. `PATCH /auth/me/password`
Ganti password mandiri (wajib password lama, memvalidasi kebijakan huruf + angka min 8 karakter).
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "oldPassword": "Password123!",
  "newPassword": "NewSecretPassword2026!"
}
```
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Password berhasil diubah",
  "data": null
}
```

---

#### 5. `POST /auth/logout`
Logout dan membatalkan token sesi saat ini dari server.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body (Opsional):**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Logout berhasil",
  "data": null
}
```

---

### 6.3 Modul 1B: Manajemen User — Owner Only (`/users`)

> [!IMPORTANT]
> Seluruh rute `/users` diproteksi secara ketat. Pengaksesan oleh role selain `OWNER` (misalnya `ADMIN` atau `WAREHOUSE`) akan langsung ditolak dengan status **`403 FORBIDDEN`**.

#### 1. `GET /users`
Mengambil daftar akun staf/pengguna dengan pencarian dan filter.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Query Params:**
  - `q` (string, opsional): Cari berdasarkan nama atau email.
  - `role` (string, opsional): `OWNER` | `ADMIN` | `WAREHOUSE`.
  - `isActive` (boolean, opsional): `true` | `false`.
  - `page` (number, default: 1): Nomor halaman.
  - `limit` (number, default: 20, max: 100): Jumlah per halaman.
- **Contoh Request:** `GET /api/v1/users?role=ADMIN&page=1&limit=10`
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Daftar pengguna berhasil diambil",
  "data": [
    {
      "id": "user-uuid-456",
      "email": "admin@jastipops.com",
      "name": "Admin JastipOps",
      "role": "ADMIN",
      "isActive": true,
      "mustChangePassword": false,
      "lastLoginAt": "2026-11-20T10:15:00.000Z",
      "createdAt": "2026-11-17T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

#### 2. `POST /users`
Membuat akun staf baru oleh Owner (`USR-1`). Password dapat diisi atau dibuatkan acak otomatis. Pengguna baru otomatis berstatus `mustChangePassword = true`.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "name": "Budi Staf Lapangan",
  "email": "budi.warehouse@jastipops.com",
  "role": "WAREHOUSE",
  "password": "InitialPass123!" 
}
```
> *Catatan: Jika `password` dikosongkan, backend otomatis membuatkan password aman dan mengembalikannya di `initialPassword`.*
- **Respons Sukses (201 Created):**
```json
{
  "success": true,
  "message": "Pengguna baru berhasil dibuat",
  "data": {
    "user": {
      "id": "user-uuid-789",
      "email": "budi.warehouse@jastipops.com",
      "name": "Budi Staf Lapangan",
      "role": "WAREHOUSE",
      "isActive": true,
      "mustChangePassword": true,
      "createdAt": "2026-11-20T12:00:00.000Z"
    },
    "initialPassword": "InitialPass123!"
  }
}
```

---

#### 3. `GET /users/:id`
Melihat detail lengkap satu akun pengguna.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`

---

#### 4. `PATCH /users/:id`
Mengubah nama, email, atau role pengguna.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body (Parsial):**
```json
{
  "name": "Budi Senior Warehouse",
  "role": "ADMIN"
}
```

---

#### 5. `PATCH /users/:id/status`
Mengaktifkan atau menonaktifkan akun staf.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "isActive": false
}
```
- **Proteksi Khusus (`LAST_OWNER_PROTECTED`):**
Bila mencoba menonaktifkan Owner satu-satunya yang masih aktif, request ditolak:
```json
{
  "success": false,
  "error": {
    "code": "LAST_OWNER_PROTECTED",
    "message": "Owner terakhir tidak bisa dinonaktifkan"
  }
}
```

---

#### 6. `POST /users/:id/reset-password`
Mereset password akun staf oleh Owner (`USR-2`). Seluruh sesi aktif user tersebut otomatis dicabut dan user diwajibkan mengganti password pada login berikutnya.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body (Opsional):**
```json
{
  "newPassword": "ResetPassword123!"
}
```
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Password pengguna berhasil direset",
  "data": {
    "temporaryPassword": "ResetPassword123!"
  }
}
```

---

### 6.4 Modul 2: Customer / CRM (`/customers`)

> [!NOTE]
> Modul Customer dapat diakses oleh role **`OWNER`** dan **`ADMIN`**. Role `WAREHOUSE` akan ditolak dengan `403 FORBIDDEN`.

#### 1. `GET /customers`
Mencari dan menampilkan daftar pelanggan yang aktif (soft-delete otomatis tersaring).
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Query Params:**
  - `q` (string, opsional): Pencarian nama atau digit nomor WhatsApp.
  - `tag` (string, opsional): `REGULAR` | `VIP` | `WARNING`.
  - `waOptIn` (boolean, opsional): `true` | `false`.
  - `page` (number, default: 1)
  - `limit` (number, default: 20)
- **Contoh Request:** `GET /api/v1/customers?q=siti&tag=VIP`
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Daftar customer berhasil diambil",
  "data": [
    {
      "id": "cust-uuid-001",
      "name": "Siti Rahma",
      "phoneWa": "6281298765432",
      "socialMedia": "@sitirahma",
      "address": "Jl. Sudirman No. 45",
      "city": "Jakarta Selatan",
      "province": "DKI Jakarta",
      "postalCode": "12190",
      "recipientName": "Siti Rahma",
      "tag": "VIP",
      "waOptIn": true,
      "waOptInAt": "2026-11-20T12:00:00.000Z",
      "notes": "Pelanggan setia promo suplemen",
      "createdAt": "2026-11-20T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

#### 2. `POST /customers`
Menambahkan data customer baru secara lengkap.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "name": "Dewi Sartika",
  "phoneWa": "0812-3456-7890", 
  "socialMedia": "@dewi_s",
  "address": "Jl. Cikini Raya No. 12",
  "city": "Jakarta Pusat",
  "province": "DKI Jakarta",
  "postalCode": "10330",
  "recipientName": "Dewi Sartika",
  "tag": "REGULAR",
  "waOptIn": true,
  "notes": "Pesanan pertama"
}
```
> *Perhatikan: Nilai `phoneWa` `"0812-3456-7890"` otomatis dinormalisasi oleh server menjadi `"6281234567890"`.*
- **Respons Sukses (201 Created):**
```json
{
  "success": true,
  "message": "Customer berhasil ditambahkan",
  "data": {
    "id": "cust-uuid-002",
    "name": "Dewi Sartika",
    "phoneWa": "6281234567890",
    "tag": "REGULAR",
    "waOptIn": true,
    "createdAt": "2026-11-20T12:05:00.000Z"
  }
}
```
- **Respons Duplikat Nomor WhatsApp (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_PHONE",
    "message": "Nomor WhatsApp sudah terdaftar",
    "details": {
      "field": "phoneWa",
      "issue": "duplicate"
    }
  }
}
```

---

#### 3. `POST /customers/quick`
Fitur tambah cepat customer langsung dari modal pembuatan pesanan (`CUS-5`). Hanya membutuhkan **nama** dan **nomor WhatsApp**.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body:**
```json
{
  "name": "Rian Kusuma",
  "phoneWa": "+62 813 9988 7766",
  "tag": "REGULAR",
  "notes": "Input cepat via WA chat"
}
```
- **Respons Sukses (201 Created):**
```json
{
  "success": true,
  "message": "Customer berhasil ditambahkan (cepat)",
  "data": {
    "id": "cust-uuid-003",
    "name": "Rian Kusuma",
    "phoneWa": "6281399887766",
    "tag": "REGULAR",
    "waOptIn": true,
    "createdAt": "2026-11-20T12:10:00.000Z"
  }
}
```

---

#### 4. `GET /customers/:id`
Melihat profil detail satu customer.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`

---

#### 5. `PATCH /customers/:id`
Mengubah data customer (seperti alamat, nomor WA baru, catatan, atau tag `VIP`/`WARNING`).
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Request Body (Parsial):**
```json
{
  "tag": "VIP",
  "notes": "Naik kelas ke pelanggan VIP"
}
```

---

#### 6. `DELETE /customers/:id`
Melakukan *soft delete* customer (`CUS-8`). Data riwayat pesanan historis tetap tersimpan utuh di database, namun customer tidak akan muncul lagi di pencarian biasa.
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Customer berhasil dihapus",
  "data": null
}
```

---

#### 7. `GET /customers/:id/orders`
Melihat riwayat transaksi dan total sisa tagihan customer (`CUS-4`).
- **Headers:** `x-api-key`, `Authorization: Bearer <accessToken>`
- **Respons Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Riwayat pesanan customer berhasil diambil",
  "data": {
    "orders": [],
    "totalSpent": 0,
    "unpaidAmount": 0
  }
}
```

---

## 7. Katalog Kode Error Standar (`error.code`)

Saat request gagal, client dapat membaca field `error.code` untuk memberikan notifikasi UI yang presisi kepada user:

| Error Code | HTTP Status | Penjelasan & Solusi UI |
|---|---|---|
| `MISSING_API_KEY` | 401 | Header `x-api-key` tidak disertakan di client. |
| `INVALID_API_KEY` | 401 | Nilai `x-api-key` salah atau tidak cocok dengan config server. |
| `UNAUTHENTICATED` | 401 | Belum login atau access token tidak disertakan. Arahkan ke `/login`. |
| `TOKEN_EXPIRED` | 401 | Token sudah habis masa berlakunya. Picu alur `/auth/refresh`. |
| `INVALID_CREDENTIALS` | 401 | Email tidak terdaftar atau password salah. |
| `USER_INACTIVE` | 403 | Akun telah dinonaktifkan oleh Owner. Tampilkan pesan blokir. |
| `PASSWORD_CHANGE_REQUIRED` | 403 | User wajib mengganti password awal. Buka modal ganti password `/auth/me/password`. |
| `FORBIDDEN` | 403 | Pengguna tidak memiliki role yang cukup untuk mengakses endpoint ini. |
| `NOT_FOUND` | 404 | Data (user, customer, atau rute) tidak ditemukan. |
| `CONFLICT` | 409 | Terjadi konflik data unik (misal: email sudah terdaftar). |
| `DUPLICATE_PHONE` | 409 | Nomor WhatsApp sudah terdaftar pada customer lain. |
| `LAST_OWNER_PROTECTED` | 400 | Dilarang menonaktifkan atau menurunkan role Owner terakhir. |
| `RATE_LIMITED` | 429 | Percobaan gagal > 5 kali dalam 15 menit. Tampilkan timer hitung mundur. |
| `VALIDATION_ERROR` | 400 | Data input tidak memenuhi skema Zod (lihat rincian di `error.details`). |
| `INTERNAL_ERROR` | 500 | Kesalahan internal server yang tidak terduga. |

---

## 8. Matriks RBAC & Aturan Sanitasi Data

Server secara otomatis membatasi akses endpoint dan menyaring field data sensitif berdasarkan role token JWT yang aktif:

| Modul / Kemampuan | `OWNER` | `ADMIN` | `WAREHOUSE` |
|---|:---:|:---:|:---:|
| **Manajemen User (`/users`)** | Full Akses | 403 Forbidden | 403 Forbidden |
| **Manajemen Customer (`/customers`)** | Full Akses | Full Akses | 403 Forbidden |
| **Self-Service Profil (`/auth/me`)** | Ya | Ya | Ya |
| **Ganti Password Sendiri** | Ya | Ya | Ya |

### Aturan Sanitasi Data Server-Side (`sanitizeForRole`):
- **Role `ADMIN`:** Otomatis disaring sehingga **tidak akan pernah** menerima field modal/keuntungan (`actualCostForeign`, `actualCostIdr`, `costRate`, `fxRatePaid`, `totalPaid*`, `profit`).
- **Role `WAREHOUSE`:** Selain field modal dan profit di atas, server juga menyaring harga IDR (`sellPriceIdr`, `feeIdr`, `totalAmount`) serta data pribadi pelanggan (`phoneWa`, `address`).
