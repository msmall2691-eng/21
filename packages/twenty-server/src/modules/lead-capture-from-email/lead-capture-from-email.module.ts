import { Module } from '@nestjs/common';
import { LeadExtractionService } from './services/lead-extraction.service';
import { EmailToOpportunityService } from './services/email-to-opportunity.service';

/**
 * Lead Capture from Email Module
 *
 * Automatically detects cleaning service requests in incoming emails
 * and converts them to CRM opportunities.
 *
 * Features:
 * - Email content analysis using keyword detection + NLP
 * - Extraction of contact info, service type, property details
 * - Confidence scoring to reduce false positives
 * - Creates Person + Opportunity from email metadata
 */
@Module({
  imports: [],
  providers: [LeadExtractionService, EmailToOpportunityService],
  exports: [LeadExtractionService, EmailToOpportunityService],
})
export class LeadCaptureFromEmailModule {}
