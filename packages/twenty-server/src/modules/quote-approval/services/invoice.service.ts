import { Injectable, Logger } from '@nestjs/common';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number; // cents
  amount: number; // cents
}

export interface InvoiceData {
  id: string;
  date: Date;
  dueDate?: Date;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  serviceType: string;
  frequency?: string;
  items: InvoiceItem[];
  subtotal: number; // cents
  tax?: number; // cents
  discount?: number; // cents
  total: number; // cents
  notes?: string;
  termsAndConditions?: string;
  paymentMethod?: string;
  stripeInvoiceId?: string;
  stripeInvoiceUrl?: string;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  /**
   * Generate invoice data from quote
   */
  generateInvoiceData(
    quoteId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    customerAddress: string,
    serviceType: string,
    frequency: string,
    estimateMin: number, // dollars
    estimateMax: number, // dollars
    sqft?: number,
    bathrooms?: number,
    notes?: string,
  ): InvoiceData {
    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Calculate amount (average of estimate range)
    const averagePrice = (estimateMin + estimateMax) / 2;
    const amountCents = Math.round(averagePrice * 100);

    // Build description
    const description = this.formatServiceDescription(
      serviceType,
      frequency,
      sqft,
      bathrooms,
    );

    const items: InvoiceItem[] = [
      {
        description,
        quantity: 1,
        unitPrice: amountCents,
        amount: amountCents,
      },
    ];

    return {
      id: `INV-${quoteId}-${now.getTime()}`,
      date: now,
      dueDate,
      customerId: `CUST-${quoteId}`,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      serviceType,
      frequency,
      items,
      subtotal: amountCents,
      total: amountCents,
      notes:
        notes ||
        'Thank you for choosing our service! We appreciate your business. Please contact us if you have any questions.',
      termsAndConditions:
        'Payment is due within 7 days of invoice date. We accept credit cards, ACH transfers, and cash.',
    };
  }

  /**
   * Format service description from quote details
   */
  private formatServiceDescription(
    serviceType: string,
    frequency: string,
    sqft?: number,
    bathrooms?: number,
  ): string {
    const serviceMap: Record<string, string> = {
      standard: 'Standard Service',
      deep: 'Deep Service',
      str: 'Vacation Rental Turnover',
      'vacation-rental': 'Vacation Rental Turnover',
      commercial: 'Commercial Service',
      'move-in-out': 'Move-In/Move-Out Service',
    };

    const freqMap: Record<string, string> = {
      weekly: 'Weekly',
      biweekly: 'Bi-Weekly',
      monthly: 'Monthly',
      'one-time': 'One-Time',
    };

    const service = serviceMap[serviceType] || serviceType;
    const freq = freqMap[frequency] || frequency;

    let description = `${service} - ${freq}`;

    if (sqft) description += ` - ${sqft} sqft`;
    if (bathrooms) description += ` - ${bathrooms} bath`;

    return description;
  }

  /**
   * Format invoice as plain text
   */
  formatInvoiceAsText(invoice: InvoiceData): string {
    const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    return `
════════════════════════════════════════════════════════════════
                        INVOICE
════════════════════════════════════════════════════════════════

Invoice #: ${invoice.id}
Date: ${invoice.date.toLocaleDateString()}
Due Date: ${invoice.dueDate?.toLocaleDateString() || 'Upon Receipt'}

────────────────────────────────────────────────────────────────
BILL TO:
${invoice.customerName}
${invoice.customerEmail}
${invoice.customerPhone}
${invoice.customerAddress}

────────────────────────────────────────────────────────────────
DESCRIPTION OF SERVICES:

${invoice.items
  .map(
    (item) => `
Service: ${item.description}
Quantity: ${item.quantity}
Unit Price: ${formatCurrency(item.unitPrice)}
Amount: ${formatCurrency(item.amount)}
`,
  )
  .join('\n')}

────────────────────────────────────────────────────────────────
SUBTOTAL:                              ${formatCurrency(invoice.subtotal)}
${invoice.tax ? `TAX:                                   ${formatCurrency(invoice.tax)}` : ''}
${invoice.discount ? `DISCOUNT:                            -${formatCurrency(invoice.discount)}` : ''}
────────────────────────────────────────────────────────────────
TOTAL DUE:                             ${formatCurrency(invoice.total)}
════════════════════════════════════════════════════════════════

NOTES:
${invoice.notes}

TERMS & CONDITIONS:
${invoice.termsAndConditions}

════════════════════════════════════════════════════════════════
Thank you for your business!
════════════════════════════════════════════════════════════════
`;
  }

  /**
   * Generate invoice summary for SMS
   */
  generateInvoiceSMSSummary(invoice: InvoiceData): string {
    const total = `$${(invoice.total / 100).toFixed(2)}`;
    return `Invoice #${invoice.id} for ${total} is ready. Due: ${invoice.dueDate?.toLocaleDateString()}. Thank you!`;
  }

  /**
   * Generate invoice summary for email
   */
  generateInvoiceEmailSummary(
    invoice: InvoiceData,
    invoiceUrl?: string,
  ): string {
    const total = `$${(invoice.total / 100).toFixed(2)}`;

    return `
<h2>Your Invoice is Ready</h2>
<p>Hi ${invoice.customerName},</p>

<p>Thank you for your business! Your invoice for ${total} is below.</p>

<h3>Invoice Details:</h3>
<ul>
  <li><strong>Invoice #:</strong> ${invoice.id}</li>
  <li><strong>Amount Due:</strong> ${total}</li>
  <li><strong>Due Date:</strong> ${invoice.dueDate?.toLocaleDateString()}</li>
  <li><strong>Service:</strong> ${invoice.items[0].description}</li>
</ul>

${invoiceUrl ? `<p><a href="${invoiceUrl}">Download Invoice PDF</a></p>` : ''}

<p>If you have any questions, please reach out.</p>

<p>Thank you!</p>
`;
  }
}
