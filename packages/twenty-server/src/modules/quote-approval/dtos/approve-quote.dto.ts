export class ApproveQuoteDto {
  token: string;
}

export class SendApprovalSMSDto {
  quoteId: string;
  phone: string;
  name: string;
  estimateMin: number;
  estimateMax: number;
  baseUrl: string;
}

export class ProcessSMSApprovalDto {
  from: string;
  body: string;
}
