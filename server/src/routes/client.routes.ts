import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { JsonResponse } from "../utils/response.js";

const clientRoutes = new Hono();

// ============================================================================
// WEB CLIENT / CUSTOMER PORTAL ROUTES — PUBLIC / CLIENT-FACING
// Layanan publik mandiri untuk pelanggan jastip.
// CATATAN: Endpoint ini TIDAK memerlukan x-api-key ataupun JWT internal.
//          Guard per-endpoint menggunakan phoneLast4 / invoiceCode sebagai
//          verifikasi ringan hingga Tahap 7 (Order Module) tersedia.
// Sesuai PRD v1.1 Non-Goals: portal pelanggan adalah fitur Fase lanjutan;
// stub ini disiapkan sebagai kerangka routing yang akan diisi di Tahap 7-12.
// ============================================================================

// Schema: pelacakan order mandiri pelanggan
const trackOrderSchema = z.object({
  invoiceCode: z.string().min(3, "Kode invoice wajib diisi (minimal 3 karakter)"),
  phoneLast4: z.string().length(4, "Wajib menyertakan 4 digit terakhir nomor WhatsApp terdaftar"),
});

/**
 * GET /client/health
 * Health-check ringan untuk client portal (bebas API-key)
 */
clientRoutes.get("/health", (c) => {
  return JsonResponse.success(c, { status: "ok" }, "Client portal aktif");
});

/**
 * GET /client/campaigns/active
 * Etalase Campaign yang sedang terbuka untuk pelanggan.
 * Implementasi penuh: Tahap 5 (Campaign & Deal)
 */
clientRoutes.get("/campaigns/active", (c) => {
  return JsonResponse.success(
    c,
    [],
    "Daftar campaign aktif untuk pelanggan (implementasi penuh: Tahap 5)"
  );
});

/**
 * GET /client/deals
 * Katalog penawaran diskon publik — harga jual IDR saja, modal/profit disembunyikan.
 * Implementasi penuh: Tahap 5 (Deal)
 */
clientRoutes.get("/deals", (c) => {
  return JsonResponse.success(
    c,
    [],
    "Katalog promo diskon pelanggan (implementasi penuh: Tahap 5)"
  );
});

/**
 * GET /client/orders/track
 * Pelacakan status order mandiri pelanggan via nomor invoice & 4-digit WA.
 * Implementasi penuh: Tahap 7 (Order Module)
 */
clientRoutes.get(
  "/orders/track",
  zValidator("query", trackOrderSchema, (result, c) => {
    if (!result.success) {
      return JsonResponse.badRequest(
        c,
        "Validasi pelacakan pesanan gagal",
        result.error.issues
      );
    }
  }),
  (c) => {
    const { invoiceCode } = c.req.valid("query");
    return JsonResponse.success(
      c,
      {
        invoiceCode,
        status: "PENDING_IMPLEMENTATION",
        note: "Implementasi penuh: Tahap 7 (Order Module)",
      },
      "Data pelacakan pesanan berhasil ditemukan"
    );
  }
);

/**
 * POST /client/orders/:invoiceCode/payment-proof
 * Pelanggan mengunggah slip bukti transfer mandiri (status PENDING_VERIFICATION).
 * Implementasi penuh: Tahap 8 (Payment Module — validasi magic-byte upload)
 */
clientRoutes.post("/orders/:invoiceCode/payment-proof", (c) => {
  const invoiceCode = c.req.param("invoiceCode");
  return JsonResponse.success(
    c,
    {
      invoiceCode,
      verificationStatus: "PENDING_VERIFICATION",
      note: "Implementasi penuh: Tahap 8 (Payment Module)",
    },
    "Bukti transfer berhasil diterima dan menunggu verifikasi Admin",
    undefined,
    202 as any
  );
});

/**
 * GET /client/orders/:invoiceCode/invoice
 * Ringkasan faktur tagihan web yang dibagikan via link WhatsApp.
 * Implementasi penuh: Tahap 12 (Rekap Tagihan Akhir)
 */
clientRoutes.get("/orders/:invoiceCode/invoice", (c) => {
  const invoiceCode = c.req.param("invoiceCode");
  return JsonResponse.success(
    c,
    {
      invoiceCode,
      note: "Implementasi penuh: Tahap 12 (Rekap Tagihan Akhir)",
    },
    "Faktur invoice digital pelanggan berhasil dimuat"
  );
});

export { clientRoutes };
