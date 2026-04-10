import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class ApprovalTokenService {
  /**
   * Generate a cryptographically secure approval token
   * Token is a 32-byte random hex string
   * Expiration is managed via database timestamp
   */
  generateToken(expiresInHours = 24): { token: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    return { token, expiresAt };
  }

  /**
   * Generate a short random code for SMS approval
   * Format: 6-digit code like "ABC123"
   */
  generateSMSCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 6);
  }

  /**
   * Build approval link for email/SMS
   */
  buildApprovalLink(
    token: string,
    baseUrl: string = 'https://twenty.example.com',
  ): string {
    return `${baseUrl}/quote-approval/${encodeURIComponent(token)}`;
  }

  /**
   * Build payment link for email/SMS
   */
  buildPaymentLink(
    quoteId: string,
    baseUrl: string = 'https://twenty.example.com',
  ): string {
    return `${baseUrl}/quote-payment/${encodeURIComponent(quoteId)}`;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Validate token format (32-byte hex = 64 chars)
   */
  isValidTokenFormat(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token);
  }
}
