# ROADMAP & CHANGE LOGS: JASTIPOPS (selaras PRD v1.1)

Urutan disusun menurut dependensi: tiap tahap hanya butuh tahap sebelumnya. Model bisnis: event diskon iHerb (**Campaign**) → katalog **Deal** → broadcast WA → order → bulk PO → gramasi & forwarder → rekap akhir.

> **Legenda:**
> - `[x]` **Selesai & terisi logika** — fungsi diimplementasikan penuh di file aslinya
> - `[ ]` **Belum dikerjakan / masih stub** — belum ada atau masih kerangka kosong
> - `[!]` **Sudah ada tapi wajib direvisi** — sebabnya tertulis di keterangan

## Aturan Global (berlaku di setiap modul, tidak diulang di bawah)
- **Urutan kerja per modul:** skema Prisma + migrasi → domain/util murni + unit test → repository → service → validator Zod → controller → route (+`authenticate`/`authorize`) → test integrasi.
- **Definition of Done modul:** (1) test RBAC per endpoint × role (401/403), (2) respons lewat `sanitizeForRole`, (3) aksi sensitif tercatat di `audit_logs`, (4) error memakai kode katalog (`AppError`), (5) `typecheck` + `test` hijau di CI.
- **Konvensi DB:** PK UUID; rupiah = `Int`; mata uang asing & kurs = `Decimal(18,4)`; waktu UTC; soft delete via `deletedAt`; tabel yang sering diedit paralel punya `version` (optimistic lock).
- **Keamanan dasar:** tidak ada logika bisnis di controller; semua input lewat Zod; field modal/harga disaring di server, bukan di UI.

---

## TAHAP 0: Fondasi Backend (Sprint 0)
- [x] Inisialisasi Hono + Node 20 + TypeScript (`server/package.json`, `tsconfig.json`)
- [x] `ApiResponse` / `JsonResponse` universal (`src/utils/response.ts`)
- [x] Config loader YAML + `.env` + Zod fail-fast (`src/config/index.ts`)
- [x] Middleware `x-api-key` timingSafeEqual (`src/middlewares/api-key.middleware.ts`)
- [x] `GET /api/v1/health` (`src/routes/index.ts`)
- [x] Health check: tambah ping DB (`SELECT 1`) agar probe deploy valid
- [x] Prisma 7 + `@prisma/adapter-pg` + `tsx` (`prisma7.config.ts`, `src/db/client.ts`)
- [x] Skema awal `User` + enum `Role` (`prisma/schema.prisma`)
- [x] Enum `Role`: ganti `SHOPPER` → `WAREHOUSE` (migrasi + seed + semua referensi `USER_ROLES`)
- [x] Seed akun awal idempoten (`prisma/seed.ts` - Owner, Admin, Warehouse)
- [!] Seed: tambah supplier `IHERB` dan `app_settings` default (setelah Tahap 4)
- [x] `AppError` + katalog kode error (`src/utils/error.ts`, `src/constants/index.ts`) + global `onError` di `app.ts` (AppError, Zod, Prisma P2002→409, P2025→404, sisanya 500 tanpa bocor stack)
- [x] Middleware keamanan: CORS whitelist (`credentials: true`), secure headers, API key guard
- [x] Utilitas bersama: `pagination.ts` (`page`, `limit` ≤ 100), `audit.ts` (`writeAuditLog`), `rateLimiter.ts` (sliding window in-memory), `phone.ts` (normalisasi WA), `sanitizer.ts` (`sanitizeForRole`)
- [x] Soft delete filter (`deletedAt: null` otomatis pada repository query)
- [x] `sanitizeForRole(role, data)`: hapus rekursif `actualCostIdr, costRate, fxRatePaid, totalPaid*, profit` untuk non-Owner; untuk `WAREHOUSE` hapus juga harga, fee, tagihan, data penerima (D14, AC1, AC2)
- [x] Test suite otomatis (`test/**/*.test.ts` via `tsx --test` - 45 test passing)
- [ ] `docker-compose.yml` (Postgres 16), `.env.example`, graceful shutdown (`prisma.$disconnect`)
- [ ] CI GitHub Actions awal: lint, typecheck, test, `prisma migrate deploy` ke DB uji
- [!] Catatan keamanan: `x-api-key` bukan rahasia bila dipegang SPA di browser. Jadikan lapisan tambahan saja; kontrol utama tetap JWT, RBAC, dan rate limit

---

## TAHAP 1: Autentikasi & Manajemen User (Modul 1)

### 1.1 Registrasi (`POST /api/v1/auth/register`)
- [x] `registerSchema` Zod validasi (file: `src/validators/auth.validator.ts`)
- [x] `hashPassword` bcryptjs (file: `src/utils/password.ts`)
- [x] `userRepository.findByEmail` & `userRepository.create` via Prisma (file: `src/repositories/user.repository.ts`)
- [x] `authService.register` — cek duplikat, hash, buat user, generate token, simpan refreshToken (file: `src/services/auth.service.ts`)
- [x] `authController.register` — error handling CONFLICT & 500 (file: `src/controllers/auth.controller.ts`)
- [x] Route publik register + `zValidator` (file: `src/routes/auth.routes.ts`)
- [x] **Tutup registrasi publik untuk produksi**: PRD hanya mengizinkan Owner membuat user (USR-1). Manajemen user dialihkan ke `POST /users` (Owner)
- [x] Kebijakan password: min 8, huruf + angka (`AUTH-5`, `validatePasswordPolicy`), dipakai juga di reset/ganti password
- [x] Test: berhasil, email duplikat, password lemah

### 1.2 Login (`POST /api/v1/auth/login`)
- [x] `loginSchema` Zod validasi (file: `src/validators/auth.validator.ts`)
- [x] `comparePassword` bcryptjs (file: `src/utils/password.ts`)
- [x] `generateAccessToken` jwt.sign ACCESS_SECRET (file: `src/utils/jwt.ts`)
- [x] `generateRefreshToken` jwt.sign REFRESH_SECRET dengan unique `jti` nonce (file: `src/utils/jwt.ts`)
- [x] `userRepository.updateRefreshToken` & multi-device `refreshTokenRepository` (file: `src/repositories/user.repository.ts`, `src/repositories/refresh-token.repository.ts`)
- [x] `authService.login` — findByEmail, cek isActive, comparePassword, generate & simpan token (file: `src/services/auth.service.ts`)
- [x] `authController.login` — error handling INVALID_CREDENTIALS, USER_INACTIVE & 500 (file: `src/controllers/auth.controller.ts`)
- [x] Route publik login + `zValidator` (file: `src/routes/auth.routes.ts`)
- [x] Login: bandingkan hash dummy bila email tidak ada via `comparePasswordDummy` (anti user-enumeration & timing attack), pesan error generik
- [x] Login: set `lastLoginAt`; kembalikan flag `mustChangePassword`
- [x] Rate limit login: 5 gagal / 15 menit per IP+email, respons `429 RATE_LIMITED` (AUTH-4, `loginRateLimiter`)
- [x] Audit: login gagal & login sukses (IP, user-agent) via `writeAuditLog`
- [x] Test: sukses, password salah, akun nonaktif ditolak (AC11), rate limit

### 1.3 Refresh Token & Logout (`POST /auth/refresh` & `POST /auth/logout`)
- [x] `verifyRefreshToken` jwt.verify REFRESH_SECRET (file: `src/utils/jwt.ts`)
- [x] `authService.refreshToken` — verifikasi token, cek DB, generate accessToken baru (file: `src/services/auth.service.ts`)
- [x] `authService.logout` — revoke token dari tabel `refresh_tokens` (file: `src/services/auth.service.ts`)
- [x] `authController.refreshToken` & `authController.logout` — error handling TOKEN_EXPIRED & UNAUTHORIZED (file: `src/controllers/auth.controller.ts`)
- [x] Route refresh & logout terdaftar (file: `src/routes/auth.routes.ts`)
- [x] Pindahkan refresh token dari kolom `users` ke tabel `refresh_tokens` (`jti` di-hash, `expiresAt`, `revokedAt`, `userAgent`, `ip`) agar mendukung banyak perangkat
- [x] Rotasi refresh token tiap pemakaian + deteksi reuse (token lama dipakai ulang → revoke semua token user)
- [x] Test: token yang sudah logout/rotasi tidak bisa dipakai

### 1.4 Profil & Ganti Password (`/auth/me`)
- [x] `authenticate` middleware — verifyAccessToken dari header Authorization Bearer, set userId/email/role ke context (file: `src/middlewares/auth.middleware.ts`)
- [x] `authService.getProfile` — findById, strip field sensitif (file: `src/services/auth.service.ts`)
- [x] `authController.me` — ambil userId dari context, panggil getProfile (file: `src/controllers/auth.controller.ts`)
- [x] Route terproteksi `GET /me` (file: `src/routes/auth.routes.ts`)
- [x] `authenticate`: cek `isActive` ke DB tiap request (token akun nonaktif langsung ditolak, AC11); jika `mustChangePassword`, tolak semua endpoint kecuali `me`, `me/password`, `logout` (`PASSWORD_CHANGE_REQUIRED`)
- [x] `authService.changePassword` (wajib password lama; set `mustChangePassword=false`; revoke semua refresh token) + controller + route `PATCH /me/password`

### 1.5 Manajemen User (Owner) (`/users`)
- [x] Middleware `authorize` RBAC — cek role dari context, tolak 403 jika role tidak sesuai (file: `src/middlewares/auth.middleware.ts`)
- [x] Migrasi: kolom `mustChangePassword`, `lastLoginAt` di `users`
- [x] Repository: list (q, role, isActive, paginasi), get, update, set status, countActiveOwners
- [x] `userService.createUser` (password awal acak, tampil sekali, `mustChangePassword=true`)
- [x] `userService.updateUser` + `toggleStatus` dengan aturan `LAST_OWNER_PROTECTED` (Owner terakhir tidak boleh dinonaktifkan/diturunkan role-nya)
- [x] `userService.resetPassword` (revoke semua token user itu)
- [x] Route `/users` (Owner saja): `GET, POST /users`, `GET, PATCH /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/reset-password`
- [x] Audit: perubahan role, status, reset password (D13)
- [x] Test: Admin & Warehouse → 403 (AC1, AC2); Owner terakhir terlindungi

### 1.6 Keamanan Tambahan
- [x] Rate limiter endpoint login (5 gagal / 15 menit per IP+email, `429 RATE_LIMITED`)
- [x] Pencatatan audit log login & perubahan akun sensitif di `audit_logs`

---

## TAHAP 2: Customer / CRM (Modul 2)
- [x] Skema `Customer`: `name, phoneWa (unik), socialMedia, address, city, province, postalCode, recipientName, tag (REGULAR/VIP/WARNING), waOptIn, waOptInAt, notes, deletedAt`
- [x] Migrasi SQL: indeks pada `name`, `phone_wa`, dan `deleted_at`
- [x] `utils/phone.ts`: normalisasi `0812…`, `+62812…`, `62812…` → `62812…`; tolak panjang tidak wajar (AC7, AC18)
- [x] `customer.validator.ts` (normalisasi otomatis di Zod `transform`, quick create schema)
- [x] Repository + service: pencarian `q` (nama / digit WA, partial, case-insensitive), filter `tag`, `waOptIn`; "tambah cepat" nama + WA (CUS-5); duplikat → `409 DUPLICATE_PHONE` (cek + tangkap P2002)
- [x] Soft delete (selalu boleh; data order tetap utuh); alamat order disalin sebagai snapshot (di Tahap 7)
- [x] Route (Owner, Admin): `GET, POST /customers`, `POST /customers/quick`, `GET, PATCH, DELETE /customers/:id`, `GET /customers/:id/orders` (CUS-4)
- [x] Test: search, duplikat WA, soft delete, 403 untuk Warehouse (AC1)
- [ ] (P1) Impor CSV dengan pratinjau + laporan error

---

## TAHAP 3: Domain Engine (fungsi murni + unit test, tanpa DB)
Dikerjakan sebelum modul bisnis agar semua rumus PRD Bagian 6 terkunci oleh test.
- [ ] `pricing.ts`: `roundUpTo`, `unitSellPriceIdr = ceil(Pf × SR, rounding)`, `unitFeeIdr` (FIXED/PERCENT), fee minimum per order, `lineTotal` (item non-billable = 0)
- [ ] `itemStatus.ts`: set status tertagih (`PENDING, PRICE_CHANGED, PURCHASED, ARRIVED`) vs tidak (`OUT_OF_STOCK, CANCELLED, DAMAGED, MISSING`)
- [ ] `weight.ts`: berat barang, buffer (flat + persen), gramasi tertagih, `billedKg` (pembulatan kelipatan forwarder + minimum), `wastedKg`
- [ ] `allocation.ts`: alokasi proporsional **sisa terbesar** (Σ alokasi = total persis; tie-break deterministik)
- [ ] `shipmentCost.ts`: mode `PASS_ON` vs `ABSORB` untuk kuota terbuang, hasilkan alokasi per order + `absorbedIdr`
- [ ] `orderTotals.ts`: subtotal, gramasi, total tagihan, sisa, `derivePaymentStatus` (UNPAID/PARTIAL/PAID/OVERPAID)
- [ ] `profit.ts`: alokasi modal PO ke item (proporsional nilai promo) + rincian fee / selisih kurs / selisih promo / margin ongkir
- [ ] `stateMachine.ts`: peta transisi Campaign, Item, Order, PO, Shipment; `assertTransition` → `409 INVALID_STATE_TRANSITION`; opsi mundur khusus Owner
- [ ] `invoice.ts`: format `JO-{KODEEVENT}-{URUT4}`
- [ ] **Test wajib:** 20 skenario pembulatan/kurs/fee/refund (AC3–AC8, AC16); data uji dari Lampiran B PRD

---

## TAHAP 4: Supplier & Produk (Modul 3a)
- [ ] Skema `Supplier` (`code` unik, `baseUrl`, `currencyCode`, `isActive`) dan `Product` (unik `supplierId+productCode`, `url`, `brand`, `variant`, `category`, `imageUrl`, `defaultWeightG`, `deletedAt`)
- [ ] Indeks trigram `Product.name` (migrasi SQL)
- [ ] Service: deteksi produk existing dari URL/kode saat input; validasi URL milik `baseUrl` supplier
- [ ] Route: `GET, POST /suppliers`, `PATCH /suppliers/:id` (tulis: Owner); `GET, POST /products`, `GET, PATCH /products/:id` (Owner, Admin)
- [ ] Test: unik produk per supplier, RBAC

---

## TAHAP 5: Campaign & Deal (Modul 3b + 4a)
### 5.1 Campaign
- [ ] Skema `Campaign`: `code` unik, `supplierId`, `minDiscountPercent`, `startsAt`, `supplierEndsAt`, `customerCutoffAt`, `currencyCode`, `sellRate`, `costRate`, fee (`feeType, feeValue, feeMinOrderIdr`), `roundingIdr`, `bufferFlatG`, `bufferPercent`, `minPaidPercent`, `minPaidPercentWarning`, `priceTolerancePercent`, `quotaWasteMode`, `iherbShippingBilled`, `estRatePerKgIdr`, `invoiceSeq`, `status`, `deletedAt`
- [ ] Enum `CampaignStatus`: `DRAFT, OPEN, CLOSED, PURCHASING, FULFILLMENT, COMPLETED, CANCELLED`
- [ ] Validasi: `customerCutoffAt < supplierEndsAt` (peringatan bila selisih < 3 jam, CMP-2); kurs > 0
- [ ] Service transisi status via `stateMachine`; mundur hanya Owner + alasan + audit
- [ ] Ubah kurs/fee/buffer: tidak mengubah order `CONFIRMED` (D3); audit perubahan kurs
- [ ] Route (Owner): `POST, PATCH /campaigns`, `PATCH /:id/status`, `POST /:id/duplicate`; (Owner, Admin): `GET /campaigns`, `GET /campaigns/:id`, `GET /:id/summary`
- [ ] Job scheduler cut-off: tiap menit `OPEN → CLOSED` bila `customerCutoffAt` lewat; idempoten, aman multi-instance (advisory lock Postgres)
- [ ] Test: transisi valid/tidak valid, job cut-off, RBAC

### 5.2 Deal (katalog promo)
- [ ] Skema `Deal`: unik `campaignId+productId`, `listPriceForeign`, `discountPercent`, `salePriceForeign`, `weightG`, `validUntil`, `stockStatus`, `isPublished`, `isClosed`, `revision`
- [ ] Service: isi salah satu dari diskon/harga promo, hitung yang lain; peringatan bila < `minDiscountPercent`; `weightG` wajib > 0 sebelum publish (`DEAL_WEIGHT_REQUIRED`); revisi harga menaikkan `revision` + audit
- [ ] Pratinjau harga jual customer memakai `pricing.ts`
- [ ] Route (Owner, Admin): `GET, POST /campaigns/:id/deals`, `PATCH /deals/:id`, `PATCH /deals/:id/status`
- [ ] Respons deal ke Warehouse tidak memuat harga IDR/fee
- [ ] Test: berat wajib, deal tertutup tidak bisa dipesan baru

---

## TAHAP 6: Broadcast WhatsApp (Modul 4b)
- [ ] Skema `Broadcast`, `BroadcastDeal`; `app_settings` untuk template teks
- [ ] Service `compose`: pilih deal terpublikasi → teks dari template; tolak deal tanpa berat / tertutup
- [ ] Log broadcast (waktu, deal, segmen, pengirim); segmen hanya customer `waOptIn = true`
- [ ] Route (Owner, Admin): `POST /campaigns/:id/broadcasts/compose`, `GET, POST /campaigns/:id/broadcasts`
- [ ] (P1) Ekspor kontak segmen CSV; generator pengingat "promo hampir berakhir"
- [ ] Test: hanya opt-in masuk segmen; deal tanpa berat ditolak

---

## TAHAP 7: Order & Item (Modul 5)
### 7.1 Skema
- [ ] `Order`: `invoiceCode` unik, `campaignId`, `customerId`, `createdById`, `source (WHATSAPP/MANUAL/LATE)`, snapshot alamat, field totals, `paymentStatus`, `orderStatus`, `version`, `deletedAt`
- [ ] `OrderItem`: `dealId, productId`, snapshot nama/merek/varian, `qty, qtyReceived, priceForeign, sellRateSnapshot, sellPriceIdr, priceIsManual, feeIdr, weightG, itemStatus, purchaseOrderId, actualCostIdr, issueNote`
- [ ] Enum: `OrderStatus {DRAFT, CONFIRMED, PURCHASED, IN_TRANSIT, ARRIVED, INVOICED, SHIPPED, DELIVERED, CANCELLED}`, `ItemStatus {PENDING, PRICE_CHANGED, PURCHASED, ARRIVED, OUT_OF_STOCK, CANCELLED, DAMAGED, MISSING}`, `PaymentStatus {UNPAID, PARTIAL, PAID, OVERPAID}`
- [ ] Indeks: `(campaignId, orderStatus)`, `(customerId)`, `(paymentStatus)`, `(purchaseOrderId)`, `(itemStatus)`

### 7.2 Logika
- [ ] Nomor invoice atomik: `UPDATE campaigns SET invoiceSeq = invoiceSeq + 1 RETURNING` dalam transaksi
- [ ] Buat order: hanya campaign `OPEN` & sebelum cut-off (`CAMPAIGN_CLOSED`); snapshot harga, kurs, fee, berat, alamat
- [ ] Hitung ulang total + gramasi dalam transaksi tiap perubahan item (memakai Tahap 3)
- [ ] Konfirmasi `DRAFT → CONFIRMED`: cek syarat bayar (`DP_REQUIRED`); harga & berat terkunci (LCK-1)
- [ ] Override harga/gramasi hanya Owner + alasan + audit (LCK-2)
- [ ] Pembatalan wajib alasan; refund via `OVERPAID`
- [ ] Optimistic lock `version` pada update order (409 bila bentrok)
- [ ] Ringkasan teks WA: item, total, gramasi, estimasi ongkir

### 7.3 Endpoint
- [ ] `GET, POST /orders` · `GET, PATCH, DELETE /orders/:id` · `PATCH /orders/:id/confirm` · `PATCH /orders/:id/status` · `PATCH /orders/:id/weight` (Owner)
- [ ] `POST /orders/:id/items` · `PATCH, DELETE /order-items/:id` · `PATCH /order-items/:id/status` (Owner, Admin)
- [ ] Test: AC11, AC13, AC14, AC15; Warehouse → 403; respons Admin tanpa field modal

---

## TAHAP 8: Pembayaran, Refund & Bukti Transfer
- [ ] Skema `Payment` (`amount Int > 0`, `type DP/PELUNASAN/REFUND`, `method`, `paidAt`, `proofPath`, `verificationStatus`, `voidReason`, `recordedById`, `verifiedById`); `paidAmount` order = turunan
- [ ] Tabel `IdempotencyKey` + middleware `Idempotency-Key` pada POST payment (AC12)
- [ ] Transaksi tunggal: insert payment + hitung ulang `paidAmount`/`paymentStatus` + audit
- [ ] Immutability: tanpa PATCH/DELETE payment; koreksi lewat `POST /payments/:id/void` + alasan (PAY-5)
- [ ] Refund otomatis: item → `OUT_OF_STOCK/CANCELLED` ⇒ total turun, bila dibayar > tagihan ⇒ `OVERPAID` + tugas refund (AC8)
- [ ] Storage Supabase: bucket privat; `POST /uploads/payment-proof` (≤ 5 MB, jpg/png/webp, **cek magic-byte**, nama acak); signed URL 5 menit
- [ ] Route (Owner, Admin): `GET, POST /orders/:id/payments`, `POST /payments/:id/void`, `PATCH /payments/:id/verify`
- [ ] Test: idempotency, void, OVERPAID, upload palsu ditolak

---

## TAHAP 9: Daftar Beli Massal & PO iHerb (Modul 7 + 9a)
- [ ] Skema `PurchaseOrder` (nomor pesanan iHerb, `promoCode`, subtotal/diskon/ongkir/pajak/total asing, `fxRatePaid`, `totalPaidIdr`, `status`, `shipmentId`)
- [ ] `GET /campaigns/:id/purchase-list`: gabung item layak per produk (BUY-1)
- [ ] Daftar tindak lanjut: belum memenuhi syarat bayar, deal habis, harga berubah (BUY-2)
- [ ] Cek harga akhir: naik > `priceTolerancePercent` ⇒ item `PRICE_CHANGED`
- [ ] `POST /campaigns/:id/start-purchasing`: tolak jika ada `PRICE_CHANGED` tak terputus; bekukan daftar, campaign → `PURCHASING`
- [ ] Ekspor teks/CSV (kode produk, URL, qty) (BUY-3)
- [ ] PO: buat dari daftar beli, alokasi item ke PO; catat hasil checkout; alokasi modal aktual ke item
- [ ] Route (Owner; GET daftar beli juga Admin)
- [ ] Test: AC9, AC10; Admin tidak melihat biaya aktual PO

---

## TAHAP 10: Planner Gramasi & Pengiriman Forwarder (Modul 8 + 9b)
- [ ] Skema `Shipment` (forwarder, kuota, `roundingKg`, `ratePerKgIdr`, `billedKg`, `chargeableTotalG`, `forwarderFeeIdr`, `status`), `ShipmentCost`, `ShipmentOrder`
- [ ] `GET /campaigns/:id/weight-plan`: total gramasi, sisa ke kelipatan berikutnya, % terpakai, estimasi biaya terbuang (WGT-1,3)
- [ ] `POST …/weight-plan/simulate` (read-only, tanpa menulis DB) (WGT-5, P1)
- [ ] Assign order ke shipment; order tidak boleh ada di dua shipment aktif
- [ ] CRUD shipment + biaya; status `PLANNED → HANDED_OVER → IN_TRANSIT → ARRIVED_ID → CLOSED`
- [ ] Order → `IN_TRANSIT` otomatis saat shipment `HANDED_OVER`
- [ ] Route (Owner; GET Admin)
- [ ] Test: AC4–AC6 pada data shipment nyata

---

## TAHAP 11: Penerimaan & Pengemasan (Modul 10)
- [ ] `GET /shipments/:id/receiving` (Warehouse hanya melihat nama produk, varian, foto, qty, berat, kode order)
- [ ] `PATCH /order-items/:id/receive`: hanya `qtyReceived`, `issue`, foto; item kurang/rusak ⇒ `MISSING/DAMAGED` dan tagihan menyesuaikan (RCV-2)
- [ ] Order → `ARRIVED` otomatis bila semua item aktif diterima/diputuskan; data penerima terbuka mulai `ARRIVED`
- [ ] Jendela koreksi 10 menit untuk membalik status salah centang; setelahnya hanya Owner/Admin
- [ ] Daftar kemas per customer (layar); foto bukti ke bucket privat
- [ ] (P1) Timbang aktual per order; cetak label PDF
- [ ] Test: AC1 (Warehouse), AC20

---

## TAHAP 12: Rekap Tagihan Akhir & Pengiriman Lokal (Modul 11 + 12)
- [ ] Skema `OrderCostLine` (`IHERB_SHIPPING, FORWARDER_INTL, CUSTOMS_TAX, DOMESTIC_COURIER, OTHER`, `isBilled`, `isManual`, `reason`)
- [ ] `POST /campaigns/:id/recap/generate`: alokasi biaya bersama per gramasi, bulatkan ke atas Rp 100 per order; blok rekonsiliasi (Σ teralokasi = total biaya aktual)
- [ ] Pratinjau semua rekap; Owner edit baris biaya (alasan wajib) sebelum terbit; terbit ⇒ terkunci (`RECAP_LOCKED`), order → `INVOICED`
- [ ] Teks rekap siap salin WA (`GET /orders/:id/invoice/text`)
- [ ] `PATCH /orders/:id/shipping` (kurir, ongkir aktual, resi); `SHIPPED` hanya bila lunas
- [ ] Campaign → `COMPLETED` otomatis bila semua order `DELIVERED/CANCELLED` & semua shipment `CLOSED`
- [ ] Route: `GET /campaigns/:id/recap`, `GET, PATCH /orders/:id/cost-lines`, `POST /orders/:id/invoice/issue`
- [ ] (P1) PDF rekap; "ambil di tempat" tanpa ongkir lokal
- [ ] Test: rekonsiliasi nol selisih, rekap terkunci

---

## TAHAP 13: Dashboard, Audit & Verifikasi Keamanan
- [ ] `GET /dashboard/campaigns/:id`: sisa waktu, omzet, order & customer, gramasi & utilisasi, modal, profit (fee / selisih kurs / promo / margin ongkir), belum lunas, progres barang, item bermasalah, performa deal (Owner lengkap · Admin operasional · Warehouse progres) (AC16)
- [ ] Skema `AuditLog` + `GET /audit-logs` (Owner); pastikan semua aksi sensitif Tahap 1–12 sudah memanggil `writeAudit`
- [ ] Audit keamanan lintas modul: matriks otomatis `endpoint × role` (401/403), scan respons Admin/Warehouse untuk field terlarang
- [ ] Konsistensi harian: job pengecek `totalAmount/paidAmount` vs hitung ulang
- [ ] (P1) Anonimisasi customer atas permintaan (UU PDP)

---

## TAHAP 14: Antarmuka Web (React + Vite + Tailwind + shadcn/ui + TanStack Query)
- [ ] Setup proyek, API client, auth (access token in-memory + refresh cookie), guard route per role
- [ ] Layar Owner/Admin: dashboard campaign, customer, produk & deal, broadcast composer, form order cepat (< 90 detik), pembayaran + preview bukti, daftar beli, PO, planner kuota, pengiriman, rekap akhir
- [ ] Layar Warehouse mobile-first: penerimaan & daftar kemas (target sentuh ≥ 44 px, filter "belum diterima")
- [ ] Hitung mundur cut-off di header; konfirmasi untuk aksi tak terbalik
- [ ] (P1) Antrean offline sederhana untuk layar Gudang

---

## TAHAP 15: Hardening & Deployment
- [ ] Test suite finansial 20 skenario + E2E Playwright (order → bayar → bulk → terima → rekap → refund)
- [ ] Benchmark pencarian < 300 ms p95 pada 50.000 customer (seed dummy) (AC17)
- [ ] Sentry + Pino produksi; OpenAPI dari skema Zod
- [ ] CI/CD lengkap: migrasi, build Docker, deploy staging → produksi
- [ ] Backup harian (retensi 14 hari) + uji restore; rotasi secret; HTTPS; env produksi aman
- [ ] UAT dengan data satu event nyata; cocokkan total tagihan vs hitungan manual (target selisih Rp 0)

---

## CHANGE LOG

### v1.1 (sinkron PRD v1.1) — 2026-11-18
- Model "Trip" diganti **Campaign** (event diskon iHerb) + **Deal**; "Shopper" menjadi **Warehouse**; Shopping List diganti **Daftar Beli Massal** + **Penerimaan**.
- Tahap baru: Domain Engine (3), Supplier & Produk (4), Broadcast (6), PO iHerb (9), Gramasi & Forwarder (10), Rekap Akhir (12).
- Urutan diubah: test, CI, `AppError`, sanitizer, dan domain engine dipindah ke depan agar semua modul bisnis dibangun di atas fondasi yang sudah teruji.
- Perbaikan keamanan: registrasi publik ditutup, refresh token multi-perangkat + rotasi, cek `isActive` tiap request, rate limit login, idempotency, validasi magic-byte upload, filter soft delete otomatis, optimistic lock, invoice atomik.

### v1.0 — 2026-11-17
- Implementasi selesai: Tahap 0 (fondasi), Tahap 1.1 (register), 1.2 (login), 1.3 (refresh/logout), 1.4 (auth middleware + profile), 1.5 (authorize RBAC).
- Fix: enum `USER_ROLES.STAFF` → `SHOPPER` sinkron schema Prisma; fix `rootDir` tsconfig; fix Prisma 7 driver adapter required.
