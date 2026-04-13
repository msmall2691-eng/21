import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { IntakePayload, IntakePayloadSchema } from '../dtos/intake-payload.dto';
import { ZodError } from 'zod';

export interface NormalizedContact {
  email: string | null;
  phone: string | null;
  name: string;
}

export interface IntakeValidationResult {
  valid: boolean;
  payload?: IntakePayload;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Service for intake webhook payload validation and normalization.
 */
@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  private readonly PERSONAL_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'me.com',
    'proton.me',
    'protonmail.com',
    'mail.com',
  ]);

  /**
   * Validate intake payload and normalize contact information.
   */
  validateAndNormalizePayload(rawPayload: unknown): IntakeValidationResult {
    // Validate with Zod
    try {
      const parsed = IntakePayloadSchema.parse(rawPayload);
      return { valid: true, payload: parsed };
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return { valid: false, errors };
      }
      return {
        valid: false,
        errors: [{ field: 'unknown', message: 'Validation failed' }],
      };
    }
  }

  /**
   * Normalize contact information (email, phone, name).
   * Returns normalized values and any conflicts found.
   */
  normalizeContact(payload: IntakePayload): NormalizedContact & { conflict?: string } {
    const name = (payload.name || '').trim();
    let email = null;
    let phone = null;
    let conflict: string | undefined;

    // Normalize email
    if (payload.email) {
      email = payload.email.toLowerCase().trim();
    }

    // Normalize phone to E.164 format
    if (payload.phone) {
      try {
        const phoneNumber = parsePhoneNumberFromString(payload.phone, 'US');
        if (phoneNumber && phoneNumber.isValid()) {
          phone = phoneNumber.format('E.164');
        } else {
          this.logger.warn(`Invalid phone number: ${payload.phone}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to parse phone: ${payload.phone}`, error);
      }
    }

    // Validate that at least email or phone is provided
    if (!email && !phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    return { email, phone, name, conflict };
  }

  /**
   * Determine if an email domain is personal (not corporate).
   */
  isPersonalEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain ? this.PERSONAL_EMAIL_DOMAINS.has(domain) : false;
  }

  /**
   * Check if a duplicate exists and throw ConflictException if needed.
   */
  checkForDuplicate(
    existingQuoteId?: string,
    existingPersonId?: string,
  ) {
    if (existingQuoteId) {
      throw new ConflictException({
        message: 'Duplicate form submission detected',
        quoteId: existingQuoteId,
      });
    }
  }
}
