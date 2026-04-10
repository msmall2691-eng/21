import { Injectable } from '@nestjs/common';

@Injectable()
export class PhoneService {
  /**
   * Normalize phone to E.164 format (+1234567890)
   * Handles US and international formats
   */
  normalizeToE164(phone: string | null | undefined): string | null {
    if (!phone) return null;

    // Remove all non-digit and non-plus characters
    const cleaned = phone.replace(/[^\d+]/g, '');

    if (!cleaned) return null;

    // If starts with +, validate and return as-is
    if (cleaned.startsWith('+')) {
      if (cleaned.length >= 10 && cleaned.length <= 15) {
        return cleaned;
      }
      return null;
    }

    // US number - extract last 10 digits and add +1
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.length > 10 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }

    return null;
  }

  /**
   * Format E.164 phone for display
   * +12025551234 → (202) 555-1234
   */
  formatForDisplay(e164: string): string {
    if (!e164.startsWith('+1') || e164.length !== 12) {
      return e164; // Return as-is if not standard US format
    }

    const digits = e164.slice(2); // Remove +1
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  /**
   * Check if phone is valid US format
   */
  isValidUSPhone(e164: string): boolean {
    return /^\+1\d{10}$/.test(e164);
  }

  /**
   * Extract country code from E.164 formatted phone
   */
  extractCountryCode(e164: string): string | null {
    const match = e164.match(/^\+(\d{1,3})/);
    return match ? match[1] : null;
  }

  /**
   * Validate phone format (E.164)
   */
  isValidFormat(phone: string): boolean {
    return /^\+\d{10,15}$/.test(phone);
  }
}
