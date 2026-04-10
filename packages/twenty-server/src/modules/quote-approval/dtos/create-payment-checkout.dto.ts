export class CreatePaymentCheckoutDto {
  quoteId: string;
  email: string;
  name?: string;
  phone?: string;
  estimateMin: number;
  estimateMax: number;
  successUrl: string;
  cancelUrl: string;
}
