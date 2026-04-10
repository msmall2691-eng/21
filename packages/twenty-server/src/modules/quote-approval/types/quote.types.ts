/**
 * Quote approval status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Approval method
 */
export type ApprovalMethod = 'sms' | 'email' | 'link';

/**
 * Quote data structure for approval workflow
 */
export interface QuoteApprovalData {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null; // E.164 format
  address: string | null;
  serviceType: string | null;
  frequency: string | null;
  estimateMin: number;
  estimateMax: number;
  estimatePrice: number; // cents
  sqft?: number;
  bathrooms?: number;
  notes?: string;
  approvalToken?: string;
  approvalTokenExpires?: Date;
  approvalStatus: ApprovalStatus;
  approvalMethod?: ApprovalMethod;
  approvalTimestamp?: Date;
  stripeCustomerId?: string;
  stripeCheckoutSessionId?: string;
  invoiceId?: string;
}

/**
 * Webhook event type
 */
export type WebhookEventType = 'quote.created' | 'quote.approved' | 'quote.payment_completed' | 'quote.payment_failed';

/**
 * Webhook event
 */
export interface WebhookEvent {
  type: WebhookEventType;
  data: Record<string, any>;
  timestamp: Date;
}
