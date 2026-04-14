import {
  FieldMetadataType,
  type ActorMetadata,
} from 'twenty-shared/types';

import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type QuoteWorkspaceEntity } from 'src/modules/quote/standard-objects/quote.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type ServiceAgreementWorkspaceEntity } from 'src/modules/service-agreement/standard-objects/service-agreement.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';

/**
 * Invoice entity tracks billing and payment status.
 * Created when a Quote is approved, or when a ServiceAgreement is established.
 *
 * Supports:
 * - One-time invoices (from approved quotes)
 * - Recurring invoices (from service agreements)
 * - Stripe/payment integration
 */
export class InvoiceWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Invoice identifier
  invoiceNumber: string; // e.g., "INV-2026-001"
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED';

  // Financial details
  amount: number; // Total in cents (e.g., 10000 = $100.00)
  amountPaid: number; // How much has been paid
  currency: string; // e.g., 'USD'

  // Dates
  issueDate: string; // When invoice was created
  dueDate: string; // When payment is due
  paidDate: string | null; // When it was paid
  sentDate: string | null; // When sent to customer

  // Links to source documents
  quote: EntityRelation<QuoteWorkspaceEntity> | null;
  quoteId: string | null; // If created from quote

  serviceAgreement: EntityRelation<ServiceAgreementWorkspaceEntity> | null;
  serviceAgreementId: string | null; // If recurring service

  // Google Calendar integration
  googleCalendarEventId: string | null; // Link to Google Calendar event ID

  // Billing details
  customer: EntityRelation<PersonWorkspaceEntity> | null;
  customerId: string | null; // Who to bill

  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null; // Customer company

  // Payment tracking
  stripeInvoiceId: string | null; // Stripe invoice ID
  paymentMethod: 'STRIPE' | 'ACH' | 'CHECK' | 'CASH' | 'OTHER' | null;
  paymentNotes: string | null;

  // Recurring invoice
  isRecurring: boolean; // Is this a recurring monthly invoice?
  recurringCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | null;
  nextBillingDate: string | null; // For recurring invoices

  // Description and notes
  description: string | null; // What services/items are included
  notes: string | null; // Internal notes

  // Metadata
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
}
