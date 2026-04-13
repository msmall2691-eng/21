import { Injectable, Logger } from '@nestjs/common';

export interface ExtractedLeadData {
  name: string | null;
  email: string;
  phone: string | null;
  serviceType: string | null;
  address: string | null;
  requestedFrequency: string | null;
  estimatedSquareFeet: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  notes: string;
  confidence: number; // 0-1, how confident we are this is a real cleaning request
}

/**
 * Extracts lead information from email content.
 * Detects cleaning service requests and extracts structured data.
 */
@Injectable()
export class LeadExtractionService {
  private readonly logger = new Logger(LeadExtractionService.name);

  private readonly CLEANING_KEYWORDS = [
    'cleaning',
    'clean',
    'maid',
    'janitorial',
    'housekeeping',
    'deep clean',
    'move-in',
    'move out',
    'move in out',
    'turnover',
    'airbnb',
    'carpet',
    'office clean',
    'commercial clean',
    'spring clean',
    'window clean',
  ];

  private readonly SERVICE_KEYWORDS: Record<string, string> = {
    'residential|house|home': 'RESIDENTIAL',
    'deep clean|thorough': 'DEEP_CLEAN',
    'move.?in|move.?out|relocation': 'MOVE_IN_OUT',
    'airbnb|turnover|vacation rental': 'AIRBNB_TURNOVER',
    'commercial|office|business': 'COMMERCIAL',
  };

  private readonly FREQUENCY_KEYWORDS: Record<string, string> = {
    'weekly|every week': 'WEEKLY',
    'bi.?weekly|every other week|biweekly': 'BI_WEEKLY',
    'monthly|every month|once a month': 'MONTHLY',
    'one.?time|one off|once|single': 'ONE_TIME',
  };

  /**
   * Extract lead data from email content.
   */
  extractLeadData(
    senderEmail: string,
    senderName: string | null,
    subject: string,
    body: string,
  ): ExtractedLeadData {
    const fullText = `${subject} ${body}`.toLowerCase();

    // Check if this looks like a cleaning request
    const isCleaningRequest = this.isCleaningRequest(fullText);
    if (!isCleaningRequest) {
      return {
        name: senderName || null,
        email: senderEmail,
        phone: null,
        serviceType: null,
        address: null,
        requestedFrequency: null,
        estimatedSquareFeet: null,
        bedrooms: null,
        bathrooms: null,
        notes: body,
        confidence: 0,
      };
    }

    // Extract details
    const serviceType = this.extractServiceType(fullText);
    const frequency = this.extractFrequency(fullText);
    const phone = this.extractPhoneNumber(body);
    const address = this.extractAddress(body);
    const { bedrooms, bathrooms, squareFeet } = this.extractPropertyDetails(fullText);

    const confidence = this.calculateConfidence({
      hasCleaningKeyword: isCleaningRequest,
      hasServiceType: !!serviceType,
      hasPhone: !!phone,
      hasAddress: !!address,
      hasPropertyDetails: bedrooms !== null || bathrooms !== null || squareFeet !== null,
    });

    return {
      name: senderName || null,
      email: senderEmail,
      phone,
      serviceType,
      address,
      requestedFrequency: frequency,
      estimatedSquareFeet: squareFeet,
      bedrooms,
      bathrooms,
      notes: body,
      confidence,
    };
  }

  /**
   * Check if email contains cleaning service keywords.
   */
  private isCleaningRequest(text: string): boolean {
    return this.CLEANING_KEYWORDS.some((keyword) =>
      text.includes(keyword),
    );
  }

  /**
   * Detect service type from email content.
   */
  private extractServiceType(text: string): string | null {
    for (const [pattern, serviceType] of Object.entries(this.SERVICE_KEYWORDS)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(text)) {
        return serviceType;
      }
    }
    return null;
  }

  /**
   * Detect requested frequency.
   */
  private extractFrequency(text: string): string | null {
    for (const [pattern, frequency] of Object.entries(this.FREQUENCY_KEYWORDS)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(text)) {
        return frequency;
      }
    }
    return null;
  }

  /**
   * Extract phone number (US format).
   */
  private extractPhoneNumber(text: string): string | null {
    // Match patterns like: (207) 555-1212, 207-555-1212, 2075551212, +1 207 555 1212
    const patterns = [
      /\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/,
      /\+1\s?(\d{3})\s?(\d{3})\s?(\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const [, area, exchange, line] = match;
        return `${area}${exchange}${line}`;
      }
    }
    return null;
  }

  /**
   * Extract address from email.
   */
  private extractAddress(text: string): string | null {
    // Simple heuristic: look for street address patterns
    // e.g., "123 Main St" or "123 Main Street"
    const addressPattern = /(\d+\s+[A-Za-z\s]+(?:St|St\.|Street|Ave|Avenue|Rd|Road|Ln|Lane|Dr|Drive|Blvd|Boulevard|Ct|Court|Pl|Place|Way)\.?)/;
    const match = text.match(addressPattern);
    return match ? match[1] : null;
  }

  /**
   * Extract property details (bedrooms, bathrooms, square feet).
   */
  private extractPropertyDetails(
    text: string,
  ): {
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
  } {
    let bedrooms: number | null = null;
    let bathrooms: number | null = null;
    let squareFeet: number | null = null;

    // Extract bedrooms
    const bedroomMatch = text.match(/(\d+)\s*(?:bedroom|bed|br|bd)/i);
    if (bedroomMatch) {
      bedrooms = parseInt(bedroomMatch[1], 10);
    }

    // Extract bathrooms
    const bathroomMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:bathroom|bath|ba)/i);
    if (bathroomMatch) {
      bathrooms = parseFloat(bathroomMatch[1]);
    }

    // Extract square feet
    const sqftMatch = text.match(/(\d+)\s*(?:sq\.?\s*ft|square feet|sqft)/i);
    if (sqftMatch) {
      squareFeet = parseInt(sqftMatch[1], 10);
    }

    return { bedrooms, bathrooms, squareFeet };
  }

  /**
   * Calculate confidence score (0-1) that this is a valid lead.
   */
  private calculateConfidence(factors: {
    hasCleaningKeyword: boolean;
    hasServiceType: boolean;
    hasPhone: boolean;
    hasAddress: boolean;
    hasPropertyDetails: boolean;
  }): number {
    let score = 0;

    if (factors.hasCleaningKeyword) score += 0.4; // High weight for explicit keyword
    if (factors.hasServiceType) score += 0.2;
    if (factors.hasPhone) score += 0.15;
    if (factors.hasAddress) score += 0.15;
    if (factors.hasPropertyDetails) score += 0.1;

    return Math.min(score, 1);
  }
}
