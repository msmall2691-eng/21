export class QuoteCreatedEvent {
  constructor(
    public readonly quoteId: string,
    public readonly personId: string,
    public readonly opportunityId: string,
    public readonly quoteNumber: string,
    public readonly total: number,
    public readonly workspaceId: string,
    public readonly source: string,
  ) {}
}
