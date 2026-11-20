import { AppError } from "./error.js";
import { ERROR_CODES } from "../constants/index.js";

/**
 * Normalizes Indonesian WhatsApp phone number to international 62xxxxxxxxxx format.
 * - Converts "0812..." -> "62812..."
 * - Converts "+62812..." -> "62812..."
 * - Converts "812..." -> "62812..."
 * - Strips non-digit characters (spaces, dashes, dots, brackets)
 * - Validates length and format (typical Indonesian mobile: 10 to 15 digits total)
 */
export function normalizePhoneWa(rawPhone: string): string {
  if (typeof rawPhone !== "string") {
    throw AppError.badRequest("Nomor WhatsApp wajib berupa string", ERROR_CODES.VALIDATION_ERROR);
  }

  // Strip all non-digit characters
  let cleaned = rawPhone.replace(/\D/g, "");

  if (!cleaned) {
    throw AppError.badRequest("Nomor WhatsApp tidak boleh kosong", ERROR_CODES.VALIDATION_ERROR);
  }

  // Handle leading 0 -> replace with 62
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  // Handle leading 8 -> prefix with 62
  else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  // Handle 62
  else if (cleaned.startsWith("62")) {
    // already starts with 62
  } else {
    // Other country code or invalid prefix
    // For local operations, assume invalid unless prefixed with 62
    throw AppError.badRequest(
      "Format nomor WhatsApp tidak didukung. Harap gunakan format nomor Indonesia (+62 / 08xx)",
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Validate mobile prefix: after 62 must be 8
  if (!cleaned.startsWith("628")) {
    throw AppError.badRequest(
      "Nomor WhatsApp Indonesia harus berupa nomor seluler (diawali dengan 08... atau 628...)",
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Validate length: 62 + 8... should be 10 to 15 digits
  if (cleaned.length < 10 || cleaned.length > 15) {
    throw AppError.badRequest(
      `Panjang nomor WhatsApp tidak wajar (${cleaned.length} digit). Nomor valid berukuran 10-15 digit.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  return cleaned;
}
