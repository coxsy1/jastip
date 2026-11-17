# ROADMAP & CHANGE LOGS: JASTIPOPS

Roadmap implementasi sistem operasional **JastipOps** disusun secara sekuensial berdasarkan spesifikasi resmi pada **Product Requirements Document (PRD v1.0)**. 
Setiap tahap dirinci dari alur dasar (Database & Utilities) hingga Endpoint, Controller, Service, dan Interface.

> **Legenda Status Sinkronisasi Kode**:
> - `[x]` **Selesai / Terisi Logika**: Komponen/fungsi sudah dibuat dan terisi logika operasional secara utuh di file aslinya.
> - `[ ]` **Belum Dikerjakan / Kerangka Fungsi Kosong**: Komponen belum dibuat, atau fungsinya sudah dideklarasikan di file aslinya namun badannya masih berupa kerangka kosong (*skeleton/stub*).

---

## TAHAP 0: Fondasi Backend & Arsitektur Inti (Sprint 0)
Fondasi infrastruktur server, konfigurasi terpusat, dan skema awal.

- [x] Inisialisasi Proyek Hono + Node.js 20 LTS + TypeScript (file: `server/package.json`, `server/tsconfig.json`)
- [x] Class Universal `JsonResponse` / `ApiResponse` (file: `src/utils/response.ts` - *Terisi logika lengkap HTTP status code & payload*)
- [x] Config Loader Terintegrasi YAML + `.env` + Zod Validation (file: `src/config/index.ts` - *Terisi logika parsing, env interpolation & fail-fast*)
- [x] Middleware Proteksi Trafik `x-api-key` (file: `src/middlewares/api-key.middleware.ts` - *Terisi logika verifikasi timingSafeEqual*)
- [x] Endpoint Health Check Publik `GET /api/v1/health` (file: `src/routes/index.ts` - *Terisi logika status ok & timestamp*)
- [x] Skema Prisma Awal Model `User` & Enum `Role` (file: `prisma/schema.prisma` - *Tabel users dan enum Role terdefinisi*)
- [x] Setup Driver Adapter PostgreSQL `@prisma/adapter-pg` dan runner `tsx` (file: `prisma7.config.ts` & `src/db/client.ts` - *Terisi logika adapter*)
- [x] Script Database Seeding Akun Awal (file: `prisma/seed.ts` - *Terisi logika upsert idempoten Owner, Admin, Shopper dengan bcryptjs*)

---

## TAHAP 1: Autentikasi & Manajemen Pengguna (Fase 1 PRD - Modul 1)
Fondasi keamanan akses, session JWT, dan kontrol akun berdasarkan peran (Owner, Admin, Shopper).

### 1.1 Alur Registrasi Akun (`POST /api/v1/auth/register`)
- [x] Skema Validasi Zod `registerSchema` (file: `src/validators/auth.validator.ts` - *Terisi logika validasi nama, email, password*)
- [x] Implementasi Utilitas Password Hashing `hashPassword` (file: `src/utils/password.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Data Access `userRepository.findByEmail` & `userRepository.create` (file: `src/repositories/user.repository.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Business Logic `authService.register` (file: `src/services/auth.service.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi HTTP Handler `authController.register` (file: `src/controllers/auth.controller.ts` - *Fungsi ada tapi masih skeleton*)
- [x] Registrasi Route Publik Register dengan `zValidator` (file: `src/routes/auth.routes.ts` - *Route terdaftar dan terhubung*)
- [ ] Unit & Integration Test Alur Registrasi (saran: uji skenario berhasil, email duplikat, dan validasi format email/password lemah)

### 1.2 Alur Login Pengguna (`POST /api/v1/auth/login`)
- [x] Skema Validasi Zod `loginSchema` (file: `src/validators/auth.validator.ts` - *Terisi logika validasi email & password*)
- [ ] Implementasi Utilitas Password Verify `comparePassword` (file: `src/utils/password.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Utilitas JWT Token Generator `generateAccessToken` (file: `src/utils/jwt.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Utilitas JWT Token Generator `generateRefreshToken` (file: `src/utils/jwt.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Data Access `userRepository.updateRefreshToken` & `updateLastLogin` (file: `src/repositories/user.repository.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Business Logic `authService.login` (file: `src/services/auth.service.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi HTTP Handler `authController.login` (file: `src/controllers/auth.controller.ts` - *Kerangka fungsi kosong*)
- [x] Registrasi Route Publik Login dengan `zValidator` (file: `src/routes/auth.routes.ts` - *Route terdaftar dan terhubung*)
- [ ] Unit & Integration Test Alur Login (saran: uji login berhasil, password salah, dan penolakan akun yang berstatus nonaktif sesuai AC11)

### 1.3 Alur Refresh Token & Logout (`POST /auth/refresh` & `POST /auth/logout`)
- [ ] Implementasi Utilitas JWT Verifier `verifyRefreshToken` (file: `src/utils/jwt.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Business Logic `authService.refreshToken` (file: `src/services/auth.service.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Business Logic `authService.logout` (file: `src/services/auth.service.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi HTTP Handler `authController.refreshToken` & `authController.logout` (file: `src/controllers/auth.controller.ts` - *Kerangka fungsi kosong*)
- [x] Registrasi Route Refresh & Logout (file: `src/routes/auth.routes.ts` - *Route terdaftar dan terhubung*)
- [ ] Unit & Integration Test Refresh & Revoke (saran: pastikan token yang telah logout tidak bisa digunakan kembali untuk refresh session)

### 1.4 Profil Pengguna & Ganti Password Mandiri (`/auth/me`)
- [ ] Implementasi Middleware Autentikasi `authenticate` (file: `src/middlewares/auth.middleware.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Business Logic `authService.getProfile` (file: `src/services/auth.service.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi Business Logic `authService.changePassword` (file: `src/services/auth.service.ts` - *Belum ada fungsi*)
- [ ] Implementasi HTTP Handler `authController.me` (file: `src/controllers/auth.controller.ts` - *Kerangka fungsi kosong*)
- [ ] Implementasi HTTP Handler `authController.changePassword` (file: `src/controllers/auth.controller.ts` - *Belum ada fungsi*)
- [x] Registrasi Route Terproteksi `GET /me` (file: `src/routes/auth.routes.ts` - *Route terdaftar*)
- [ ] Registrasi Route Terproteksi `PATCH /me/password` (file: `src/routes/auth.routes.ts` - *Belum didaftarkan*)

### 1.5 Manajemen User & RBAC Owner (`/users`)
- [ ] Implementasi Middleware Otorisasi RBAC `authorize` (file: `src/middlewares/auth.middleware.ts` - *Kerangka fungsi kosong*)
- [ ] Migrasi Database: Tambah Kolom `must_change_password` & `last_login_at` pada tabel `users` (file: `prisma/schema.prisma` - *Belum ditambahkan*)
- [ ] Implementasi Skema Zod & Data Access CRUD User di `src/repositories/user.repository.ts` (saran: sediakan query list user, get by id, update role, dan toggle active status)
- [ ] Implementasi Business Logic `userService.createUser` oleh Owner (saran: generate password acak/awal dan set `must_change_password = true` sesuai USR-1)
- [ ] Implementasi Business Logic `userService.toggleUserStatus` (saran: terapkan aturan proteksi `LAST_OWNER_PROTECTED`: Owner terakhir tidak boleh dinonaktifkan atau diturunkan role-nya sesuai USR-4)
- [ ] Implementasi Business Logic `userService.resetPassword` (saran: Owner dapat mereset password staf dan mewajibkan ganti password pada login berikutnya sesuai USR-2)
- [ ] Implementasi Controller & Route `src/routes/user.routes.ts` (saran: pasang guard `authenticate` dan `authorize(USER_ROLES.OWNER)`)
- [ ] Unit & Integration Test RBAC User Management (saran: uji Admin/Shopper ditolak 403 saat mengakses modul user sesuai AC2)

### 1.6 Keamanan Tambahan & Rate Limiting
- [ ] Implementasi Rate Limiter pada Endpoint Login (saran: batasi maksimal 5 percobaan gagal per 15 menit per kombinasi IP + Email sesuai AUTH-4)
- [ ] Pencatatan Audit Log Percobaan Login & Perubahan Akun (saran: catat aksi sensitif perubahan role dan reset password ke tabel `audit_logs` sesuai D13)

---

## TAHAP 2: Manajemen Pelanggan / CRM (Fase 1 PRD - Modul 2)
Pencatatan data pelanggan, normalisasi nomor WhatsApp, pengelompokan tag, dan riwayat belanja.

### 2.1 Skema & Indeks Database Customer
- [ ] Buat Skema Prisma Model `Customer` di `prisma/schema.prisma` (saran: sertakan `name`, `phoneWa`, `socialMedia`, `address`, `city`, `province`, `postalCode`, `recipientName`, `tag`, `notes`, `deletedAt`)
- [ ] Setup Ekstensi PostgreSQL `pg_trgm` & Indeks GIN pada kolom `name` dan `phone_wa` (saran: untuk menjamin performa pencarian customer p95 < 300 ms dengan 50.000 data sesuai AC6)
- [ ] Jalankan Migrasi Prisma untuk Tabel Customer `npx prisma migrate dev --name create_customers_table`

### 2.2 Normalisasi WhatsApp & Deteksi Duplikat
- [ ] Utilitas Normalisasi Nomor WhatsApp di `src/utils/phone.ts` (saran: ubah format `0812...`, `+62812...`, dan `62812...` menjadi standar `62812...` sesuai AC7)
- [ ] Skema Validasi Zod Customer di `src/validators/customer.validator.ts` (saran: terapkan sanitasi nomor WA otomatis dan validasi tag `REGULAR`, `VIP`, `WARNING`)

### 2.3 Layanan & Endpoint Customer (`/customers`)
- [ ] Implementasi Data Access `customerRepository` (saran: terapkan soft delete dengan memfilter record yang memiliki `deleted_at IS NULL` secara default sesuai D12)
- [ ] Implementasi Customer Service (saran: dukung fitur "tambah cepat" nama + WA dari modal pesanan sesuai CUS-5)
- [ ] Implementasi Controller & Routes Customer:
  - `GET /api/v1/customers` (Query: `q`, `tag`, `page`, `limit`)
  - `POST /api/v1/customers` (Role: Owner & Admin)
  - `GET /api/v1/customers/:id` (Role: Owner & Admin)
  - `PATCH /api/v1/customers/:id` (Role: Owner & Admin)
  - `DELETE /api/v1/customers/:id` (Soft delete; tolak jika customer memiliki order aktif sesuai CUS-8)
  - `GET /api/v1/customers/:id/orders` (Riwayat transaksi & total sisa belum lunas sesuai CUS-4)
- [ ] Unit & Integration Test Modul Customer (saran: uji pencarian trigram, deteksi duplikat WA 409, dan soft delete)

---

## TAHAP 3: Manajemen Trip / Batch Jastip (Fase 2 PRD - Modul 3)
Perencanaan batch perjalanan belanja, pengaturan kurs mata uang, fee jastip, dan state machine trip.

### 3.1 Skema & Migrasi Database Trip
- [ ] Buat Skema Prisma Model `Trip` di `prisma/schema.prisma` (saran: sertakan `code` unik misal BKK12, `destination`, `currencyCode`, `sellRate`, `costRate`, `feeType`, `defaultFee`, `roundingIdr`, rentang tanggal PO, dan status `TripStatus`)
- [ ] Enum `TripStatus`: `OPEN`, `SHOPPING`, `SHIPPING`, `COMPLETED`
- [ ] Jalankan Migrasi Prisma untuk Tabel Trip

### 3.2 State Machine & Business Logic Trip
- [ ] Implementasi State Machine Transisi Status Trip di `src/services/trip.service.ts` (saran: alur hanya boleh maju `OPEN -> SHOPPING -> SHIPPING -> COMPLETED`; transisi mundur hanya boleh dilakukan oleh Owner dengan alasan tercatat sesuai TRP-4 & Bagian 7)
- [ ] Validasi Pembuatan Pesanan: Order baru hanya boleh dibuat jika trip berstatus `OPEN` (TRP-5)
- [ ] Peringatan Order Draft: Berikan peringatan jika masih ada order bertatus `DRAFT` saat trip berpindah ke `SHOPPING` (TRP-6)
- [ ] Fitur Hitung Ulang Kurs Trip (`POST /trips/:id/recalculate`) (saran: sediakan opsi apakah kurs baru hanya berlaku untuk pesanan baru atau menghitung ulang order belum bayar sesuai TRP-7)
- [ ] Fitur Duplikasi Pengaturan Trip (TRP-8)

### 3.3 Controller & Endpoint Trip (`/trips`)
- [ ] `GET /api/v1/trips` & `GET /api/v1/trips/:id` (Akses: Owner & Admin)
- [ ] `POST /api/v1/trips` & `PATCH /api/v1/trips/:id` (Hak Tulis: Khusus Owner)
- [ ] `PATCH /api/v1/trips/:id/status` (Akses: Owner)
- [ ] `GET /api/v1/trips/:id/summary` (Ringkasan total pesanan dan estimasi belanja)

---

## TAHAP 4: Manajemen Pesanan & Barang Titipan (Fase 2 PRD - Modul 4)
Pencatatan order pelanggan, formula perhitungan harga IDR, fee jastip, dan siklus hidup item.

### 4.1 Skema & Migrasi Database Order & Order Items
- [ ] Skema Prisma Model `Order` (saran: invoice code unik `JO-{KODETRIP}-{URUT4}`, snapshot alamat customer, `payment_status`, `order_status`, `deleted_at`)
- [ ] Skema Prisma Model `OrderItem` (saran: snapshot kurs `sell_rate_snapshot`, `foreign_price`, `sell_price_idr`, `jastip_fee_idr`, `actual_cost_foreign`, `item_status`)
- [ ] Enum `OrderStatus`: `DRAFT`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- [ ] Enum `OrderItemStatus`: `PENDING`, `PURCHASED`, `OUT_OF_STOCK`, `ARRIVED`
- [ ] Enum `PaymentStatus`: `UNPAID`, `PARTIAL`, `PAID`, `OVERPAID`

### 4.2 Formula Engine Kalkulasi Finansial Pesanan
- [ ] Utilitas Formula Harga Jual IDR di `src/utils/pricing.ts` (saran: rumus `round_up(foreign_price * sell_rate, pembulatan)` dengan default pembulatan ke Rp 100 terdekat sesuai D4, D5, dan Rumus Bagian 6)
- [ ] Utilitas Kalkulasi Total Tagihan Order: `total_tagihan = subtotal_items + shipping_cost - discount` (Rumus 4)
- [ ] Aturan Wajib DP untuk Customer WARNING: Larang transisi order ke `CONFIRMED` sebelum pembayaran DP minimal 50% tercatat sesuai D16 & PAY-7

### 4.3 State Machine Item & Order Locking
- [ ] Transisi Status Item Belanja: `PENDING -> PURCHASED -> ARRIVED` atau `OUT_OF_STOCK` (saran: tolak transisi tidak valid dengan 409 `INVALID_STATE_TRANSITION`)
- [ ] Otomatisasi Status Order: Order otomatis beralih dari `CONFIRMED` ke `PROCESSING` saat item pertama berstatus `PURCHASED` (ORD-6)
- [ ] Penguncian Item: Larang penambahan atau penghapusan item jika order sudah berstatus `PROCESSING` (ORD-7)
- [ ] Alur Pembatalan Order (`CANCELLED`): Wajib menyertakan alasan; jika ada dana masuk otomatis berstatus `OVERPAID` untuk proses refund (ORD-8)

### 4.4 Controller & Endpoint Order (`/orders`)
- [ ] `GET /api/v1/orders` & `POST /api/v1/orders` (Akses: Owner & Admin)
- [ ] `GET /api/v1/orders/:id` & `PATCH /api/v1/orders/:id` (Akses: Owner & Admin)
- [ ] `POST /api/v1/orders/:id/items` & `PATCH /order-items/:id/status` (Akses: Semua staf sesuai RBAC)
- [ ] Generator Ringkasan Teks Invoice WhatsApp (ORD-10)

---

## TAHAP 5: Manajemen Pembayaran, Refund & Bukti Transfer (Fase 2 PRD)
Pencatatan pembayaran bertahap (DP/Pelunasan), rekonsiliasi otomatis, refund barang kosong, dan upload bukti transfer.

### 5.1 Skema & Migrasi Database Payments
- [ ] Buat Skema Prisma Model `Payment` di `prisma/schema.prisma` (saran: kolom `amount` integer rupiah tanpa desimal sesuai D4, tipe `DP`, `PELUNASAN`, `REFUND`, metode pembayaran, `proof_path`, status verifikasi)
- [ ] Relasi 1-N Order ke Payments (saran: jangan simpan paid_amount mentah di order, jadikan sebagai kalkulasi turunan dari tabel payments sesuai D8)

### 5.2 Pencatatan Pembayaran & Proteksi Idempotency
- [ ] Middleware / Handler Header `Idempotency-Key` (saran: simpan key di cache/DB untuk mencegah pembayaran ganda akibat double submit atau koneksi terputus sesuai AC9)
- [ ] Integritas Transaksi Database: Jalankan pencatatan pembayaran dan pembaruan status order dalam satu transaksi database Prisma (`prisma.$transaction`) sesuai Rumus 9
- [ ] Penanganan Immutability Pembayaran: Pembayaran tidak bisa diedit atau dihapus; koreksi hanya bisa dilakukan via pembatalan (`void`) dengan alasan wajib sesuai PAY-5 & AC8

### 5.3 Integrasi File Storage (Supabase Storage)
- [ ] Setup Client Supabase Storage untuk Bukti Transfer (saran: gunakan private bucket untuk bukti transfer pembayaran sesuai D11)
- [ ] Endpoint Upload Bukti Pembayaran `POST /api/v1/uploads/payment-proof` (saran: validasi ukuran file maksimal 5MB dan format jpg/png/webp)
- [ ] Generator Signed URL Berumur Pendek (5 Menit) untuk Gambar Bukti Transfer (saran: jangan ekspos URL statis publik untuk bukti transfer sesuai D11)

### 5.4 Logika Refund Otomatis (Barang Kosong / OUT_OF_STOCK)
- [ ] Implementasi Mekanisme Refund Otomatis: Saat item ditandai `OUT_OF_STOCK`, nilai item di-nol-kan dari tagihan; jika total bayar > tagihan, status order otomatis menjadi `OVERPAID` dan muncul task refund (D9, AC3 & Rumus 10)
- [ ] Pencatatan Pembayaran Tipe `REFUND` saat uang dikembalikan ke pelanggan (saran: catat tanpa menghapus riwayat pembayaran DP sebelumnya)

---

## TAHAP 6: Manajemen Pengiriman & Logistik (Fase 2 PRD)
Input resi ekspedisi, update ongkos kirim real, dan penyelesaian order.

- [ ] Endpoint Update Pengiriman `PATCH /api/v1/orders/:id/shipping` (saran: input ekspedisi, layanan, ongkos kirim, dan nomor resi sesuai SHP-1)
- [ ] Rekalkulasi Sisa Tagihan Berdasarkan Ongkos Kirim: Perubahan ongkir otomatis memperbarui total tagihan order (SHP-2)
- [ ] Validasi Prasyarat `SHIPPED`: Order dilarang beralih ke status `SHIPPED` bila masih ada item berstatus `PENDING` sesuai SHP-3 & AC10
- [ ] Penyelesaian Order: Transisi order ke `DELIVERED` dan penyelesaian akhir trip ke `COMPLETED`

---

## TAHAP 7: Aplikasi Lapangan Shopper (Mobile-First) (Fase 3 PRD - Modul 5)
Tampilan daftar belanja terkonsolidasi untuk shopper di luar negeri, centang belanja cepat, dan update status.

### 7.1 Generator & Agregasi Shopping List
- [ ] Endpoint `GET /api/v1/trips/:id/shopping-list` (saran: gabungkan item `PENDING` dari seluruh order `CONFIRMED` dan `PROCESSING` dalam satu trip per kategori + nama + merek + varian sesuai SHL-1)
- [ ] Proteksi Privasi Pelanggan untuk Shopper: Strip seluruh data pribadi pelanggan (nama, nomor WA, alamat), harga jual IDR, dan fee jastip dari response API untuk role Shopper sesuai AC1 & PRD Bagian 4

### 7.2 Eksekusi Belanja Lapangan (FIFO Allocation)
- [ ] Endpoint Update Belanja `PATCH /api/v1/trips/:id/shopping-list/:groupKey` (saran: input `qty_purchased` atau status `Kosong`, sistem mengalokasikan hasil belanja ke order items pemesan berdasarkan urutan order masuk / FIFO sesuai SHL-3)
- [ ] Aturan Jendela Koreksi 10 Menit: Shopper diizinkan membatalkan status `PURCHASED -> PENDING` dalam kurun waktu 10 menit untuk koreksi salah sentuh; setelah 10 menit pengubahan hanya dapat dilakukan oleh Owner/Admin (PRD Bagian 7)
- [ ] Pencatatan Harga Modal Aktual: Input harga beli mata uang asing aktual dan upload foto struk belanja sesuai SHL-4

---

## TAHAP 8: Dashboard Profitabilitas, Audit Log & Keamanan (Fase 3 PRD - Modul 6)
Laporan margin bersih, pembatasan ketat field modal, dan sistem audit terpusat.

### 8.1 Server-side Data Stripping (Modal & Profit Guard)
- [ ] Middleware / Serializer Filter Hak Lihat Modal: Hapus field modal (`cost_*`, `profit`, `actual_cost_foreign`) secara server-side dari semua response jika pengakses bukan role `OWNER` sesuai D14 & AC2

### 8.2 Dashboard Finansial Trip (`GET /api/v1/dashboard/trips/:id`)
- [ ] Kalkulasi Metrik Finansial Real-time:
  - Omzet Kotor: Total tagihan order aktif tanpa ongkir
  - Total Modal Belanja: `Σ (harga beli aktual asing × qty × cost_rate)` (Rumus 7)
  - Estimasi Profit Bersih: Omzet kotor - total modal (Dirinci: total fee + selisih kurs + selisih harga sesuai Rumus 8)
  - Progres Belanja: Persentase item terbeli (dapat dilihat oleh Shopper/Admin)
  - Kas Masuk & Nilai Refund Tertunda

### 8.3 Sistem Audit Trail Terpusat
- [ ] Skema Prisma Model `AuditLog` di `prisma/schema.prisma` (saran: kolom `actorId`, `entity`, `entityId`, `action`, `before` JSONB, `after` JSONB, `createdAt` sesuai D13)
- [ ] Interceptor / Service Helper Perekam Audit: Rekam otomatis setiap perubahan sensitif pada harga, kurs, status pembayaran void, dan pergantian role staf
- [ ] Endpoint Audit Log `GET /api/v1/audit-logs` (Akses: Khusus Owner)

---

## TAHAP 9: Antarmuka Web Backoffice & Tampilan Mobile Shopper
Pembangunan antarmuka web modern, responsif, dan terintegrasi dengan backend API.

- [ ] Inisialisasi Project Web App: React + Vite + Tailwind CSS + shadcn/ui + TanStack Query + React Router (PRD Bagian 3)
- [ ] Autentikasi Frontend: Penyimpanan access token di in-memory state dan sinkronisasi session refresh token
- [ ] Modul Backoffice Desktop (Owner & Admin):
  - Dashboard ringkasan operasional dan finansial
  - Manajemen Customer dengan pencarian instan dan filter tag
  - Pembuatan Trip dan pengaturan kurs mata uang
  - Form Input Multi-item Order Cepat (< 2 menit per order)
  - Modal verifikasi pembayaran dan preview bukti transfer signed URL
- [ ] Modul Mobile-First Shopper:
  - Antarmuka daftar belanja satu tangan dengan tombol centang besar (target sentuh ≥ 44px)
  - Indikator koneksi dan antrean perubahan offline sederhana untuk mengatasi sinyal buruk di toko luar negeri sesuai SHL-5

---

## TAHAP 10: Pengujian Otomatis, Hardening & Deployment
Validasi kriteria penerimaan (Acceptance Criteria), pengujian beban, dan rilis produksi.

- [ ] Setup Vitest & Integrasi Database Container untuk Testing API
- [ ] Test Suite Skenario Finansial: Uji akurasi 20 skenario kalkulasi (pembulatan, kurs dinamis, DP bertahap, refund barang kosong sesuai AC4)
- [ ] Benchmark Performa Pencarian Customer: Uji beban pencarian < 300 ms dengan 50.000 record dummy sesuai AC6
- [ ] Integrasi Observability: Structured logging dengan Pino dan error monitoring dengan Sentry (PRD Bagian 3)
- [ ] Setup GitHub Actions CI/CD: Linting, typecheck, testing otomatis, migrasi database, dan build Docker
- [ ] Deployment ke Server Produksi (Railway/Render/VPS) dengan domain HTTPS dan environment variables aman
