import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { IntakeService } from '../services/intake.service';
import { IntakePayloadResponse } from '../dtos/intake-payload.dto';

/**
 * Webhook controller for quote intake requests from maineclean.co
 * Receives form submissions and creates Person + Opportunity + Quote
 */
@Controller('api/quote-intake')
export class IntakeWebhookController {
  private readonly logger = new Logger(IntakeWebhookController.name);

  constructor(private intakeService: IntakeService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleIntakeWebhook(
    @Body() rawPayload: unknown,
    @Headers('x-intake-secret') secret: string,
  ): Promise<IntakePayloadResponse> {
    // Validate secret
    const expectedSecret = process.env.QUOTE_INTAKE_SECRET;
    if (!secret || !this.constantTimeCompare(secret, expectedSecret || '')) {
      throw new UnauthorizedException('Invalid intake secret');
    }

    // Validate and normalize payload
    const validation = this.intakeService.validateAndNormalizePayload(rawPayload);
    if (!validation.valid) {
      return {
        ok: false,
        errors: validation.errors || [],
      };
    }

    const payload = validation.payload!;

    // Normalize contact
    try {
      const contact = this.intakeService.normalizeContact(payload);
      this.logger.debug(`Normalized contact: ${contact.name} (${contact.email}, ${contact.phone})`);
    } catch (error) {
      return {
        ok: false,
        errors: [
          {
            field: 'contact',
            message: (error as any).message || 'Invalid contact information',
          },
        ],
      };
    }

    // TODO: Check for existing quote by externalFormId (idempotency)
    // TODO: Upsert Person by email/phone
    // TODO: Upsert Company if non-personal email
    // TODO: Create/link Opportunity
    // TODO: Create Quote
    // TODO: Emit QuoteCreated event

    // For now, return a placeholder response
    return {
      ok: true,
      quoteId: '00000000-0000-0000-0000-000000000000',
      personId: '00000000-0000-0000-0000-000000000000',
      opportunityId: '00000000-0000-0000-0000-000000000000',
      quoteNumber: 'Q-2026-0001',
    };
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private constantTimeCompare(a: string, b: string): boolean {
    const aLen = Buffer.byteLength(a);
    const bLen = Buffer.byteLength(b);

    // Return false immediately if lengths don't match
    // This is acceptable since the secret length is known
    if (aLen !== bLen) {
      return false;
    }

    const aBuf = Buffer.alloc(aLen);
    const bBuf = Buffer.alloc(bLen);
    aBuf.write(a);
    bBuf.write(b);

    let result = 0;
    for (let i = 0; i < aLen; i++) {
      result |= aBuf[i] ^ bBuf[i];
    }

    return result === 0;
  }
}
