import { Injectable, Logger } from '@nestjs/common';
import { LeadExtractionService, ExtractedLeadData } from './lead-extraction.service';

/**
 * Service for converting emails into CRM opportunities.
 * Detects cleaning requests in email threads and creates Person + Opportunity.
 */
@Injectable()
export class EmailToOpportunityService {
  private readonly logger = new Logger(EmailToOpportunityService.name);

  // Min confidence to auto-create opportunity (0-1)
  private readonly MIN_CONFIDENCE_TO_CREATE = 0.3;

  constructor(private leadExtractionService: LeadExtractionService) {}

  /**
   * Analyze an email and decide if it should create an opportunity.
   * Returns null if confidence is below threshold.
   */
  async analyzeEmailForOpportunity(
    senderEmail: string,
    senderName: string | null,
    subject: string,
    body: string,
  ): Promise<{
    shouldCreateOpportunity: boolean;
    leadData: ExtractedLeadData;
    reason: string;
  }> {
    const leadData = this.leadExtractionService.extractLeadData(
      senderEmail,
      senderName,
      subject,
      body,
    );

    const shouldCreate = leadData.confidence >= this.MIN_CONFIDENCE_TO_CREATE;
    const reason = this.getAnalysisReason(leadData);

    return {
      shouldCreateOpportunity: shouldCreate,
      leadData,
      reason,
    };
  }

  /**
   * Generate a human-readable reason for the analysis result.
   */
  private getAnalysisReason(leadData: ExtractedLeadData): string {
    if (leadData.confidence === 0) {
      return 'No cleaning service keywords detected';
    }

    const factors: string[] = [];
    if (leadData.serviceType) factors.push(`Service: ${leadData.serviceType}`);
    if (leadData.requestedFrequency) factors.push(`Frequency: ${leadData.requestedFrequency}`);
    if (leadData.phone) factors.push('Phone provided');
    if (leadData.address) factors.push('Address provided');

    return factors.length > 0
      ? `Potential lead: ${factors.join(', ')}`
      : 'Partial cleaning request (may need manual review)';
  }

  /**
   * Build opportunity data from extracted lead information.
   * This is returned; the caller is responsible for creating the Opportunity.
   */
  buildOpportunityData(leadData: ExtractedLeadData, personId: string, companyId?: string) {
    const description = this.buildOpportunityDescription(leadData);

    return {
      personId,
      companyId: companyId || null,
      stage: 'New Lead',
      amount: null, // Will be populated when quote is created
      closeDate: null,
      probability: Math.round(leadData.confidence * 100), // Use confidence as probability
      description,
      metadata: {
        source: 'email',
        extractedServiceType: leadData.serviceType,
        extractedFrequency: leadData.requestedFrequency,
        extractedSquareFeet: leadData.estimatedSquareFeet,
        extractedBedrooms: leadData.bedrooms,
        extractedBathrooms: leadData.bathrooms,
        extractedAddress: leadData.address,
      },
    };
  }

  /**
   * Build a description for the opportunity from lead data.
   */
  private buildOpportunityDescription(leadData: ExtractedLeadData): string {
    const lines: string[] = ['**Lead Source:** Email'];

    if (leadData.serviceType) {
      lines.push(`**Service Type:** ${leadData.serviceType}`);
    }

    if (leadData.requestedFrequency) {
      lines.push(`**Frequency:** ${leadData.requestedFrequency}`);
    }

    if (leadData.address) {
      lines.push(`**Address:** ${leadData.address}`);
    }

    const propertyDetails: string[] = [];
    if (leadData.bedrooms !== null) propertyDetails.push(`${leadData.bedrooms} bed`);
    if (leadData.bathrooms !== null) propertyDetails.push(`${leadData.bathrooms} bath`);
    if (leadData.estimatedSquareFeet !== null) propertyDetails.push(`${leadData.estimatedSquareFeet} sq ft`);

    if (propertyDetails.length > 0) {
      lines.push(`**Property:** ${propertyDetails.join(', ')}`);
    }

    if (leadData.phone) {
      lines.push(`**Phone:** ${leadData.phone}`);
    }

    lines.push(`**Confidence:** ${Math.round(leadData.confidence * 100)}%`);

    return lines.join('\n');
  }
}
