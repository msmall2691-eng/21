# Quote Module - Spec 01: Website Intake → Draft Quote

This module implements the website intake-to-quote workflow for The Maine Cleaning Co., bridging form submissions on maineclean.co to draft quotes in Twenty CRM.

## Architecture

The Quote module is composed of:
- **WorkspaceEntities**: `QuoteWorkspaceEntity` and `PricingConfigWorkspaceEntity`
- **Services**: 
  - `IntakeService` — validates and normalizes webhook payloads
  - `QuoteService` — creates quotes from intake requests
  - `PricingService` — calculates line items and totals based on configuration
  - `QuoteNumberService` — generates sequential quote numbers
- **Controller**: `IntakeWebhookController` — listens for form submissions from maineclean.co
- **Events**: `QuoteCreatedEvent` — emitted when a quote is created

## Webhook Endpoint

```
POST /api/quote-intake/webhook
```

### Authentication

The webhook requires a shared secret via the `X-Intake-Secret` header:

```bash
X-Intake-Secret: <QUOTE_INTAKE_SECRET from env>
```

Validation is constant-time to prevent timing attacks.

### Request Contract

```json
{
  "formId": "mc-2026-04-13-abc123",
  "submittedAt": "2026-04-13T14:20:00Z",
  "source": "maineclean.co",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+12075551212",
  "address": {
    "line1": "12 Main St",
    "line2": "Apt 4",
    "city": "Portland",
    "state": "ME",
    "zip": "04101"
  },
  "serviceType": "residential",
  "frequency": "biweekly",
  "squareFeet": 1800,
  "bedrooms": 3,
  "bathrooms": 2,
  "addOns": ["inside_fridge", "inside_oven"],
  "estimateShown": 285.00,
  "notes": "Prefer Tuesday afternoons"
}
```

**Required fields:**
- `name` — customer name
- At least one of `email` or `phone` — contact information
- `serviceType` — e.g., `RESIDENTIAL`, `DEEP_CLEAN`, `MOVE_IN_OUT`, `AIRBNB_TURNOVER`, `COMMERCIAL`, `OTHER`

**Optional fields:**
- `formId` — idempotency key; if seen before, returns 409 with existing quote ID
- `submittedAt`, `source`, `address`, `serviceType`, `frequency`
- `squareFeet`, `bedrooms`, `bathrooms`, `addOns`, `estimateShown`, `notes`

### Response Contract

**On success (200):**
```json
{
  "ok": true,
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "personId": "550e8400-e29b-41d4-a716-446655440001",
  "opportunityId": "550e8400-e29b-41d4-a716-446655440002",
  "quoteNumber": "Q-2026-0001"
}
```

**On validation error (400):**
```json
{
  "ok": false,
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "name", "message": "Required" }
  ]
}
```

**On auth failure (401):**
```json
{
  "ok": false,
  "error": "Invalid intake secret"
}
```

**On duplicate form (409):**
```json
{
  "ok": false,
  "error": "Duplicate form submission detected",
  "quoteId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Testing the Webhook

### Prerequisites

1. Generate a secret:
   ```bash
   openssl rand -hex 32
   ```
   Result: `<QUOTE_INTAKE_SECRET>`

2. Set environment variables:
   ```bash
   export QUOTE_INTAKE_SECRET="<generated secret>"
   export QUOTE_EXPIRATION_DAYS=30
   export QUOTE_DEFAULT_TAX_RATE=0.055
   ```

3. Start the development server:
   ```bash
   yarn start
   ```

### Test Happy Path

```bash
curl -X POST http://localhost:3000/api/quote-intake/webhook \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: $(echo $QUOTE_INTAKE_SECRET)" \
  -d '{
    "formId": "test-form-2026-04-13-001",
    "submittedAt": "2026-04-13T14:20:00Z",
    "source": "maineclean.co",
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "address": {
      "line1": "123 Main St",
      "city": "Portland",
      "state": "ME",
      "zip": "04101"
    },
    "serviceType": "residential",
    "frequency": "biweekly",
    "squareFeet": 1800,
    "bedrooms": 3,
    "bathrooms": 2,
    "addOns": ["inside_fridge", "inside_oven"],
    "estimateShown": 285.00,
    "notes": "Prefer Tuesday afternoons"
  }'
```

Expected: `200 OK` with quote ID.

### Test Auth Failure

```bash
curl -X POST http://localhost:3000/api/quote-intake/webhook \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: invalid-secret" \
  -d '{"name": "Test", "email": "test@example.com", "serviceType": "residential"}'
```

Expected: `401 Unauthorized`.

### Test Validation Error

```bash
curl -X POST http://localhost:3000/api/quote-intake/webhook \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: $(echo $QUOTE_INTAKE_SECRET)" \
  -d '{"name": "Test"}'  # missing email/phone and serviceType
```

Expected: `400 Bad Request` with error details.

### Test Idempotency

Submit the same form twice with the same `formId`:

```bash
curl -X POST http://localhost:3000/api/quote-intake/webhook \
  -H "Content-Type: application/json" \
  -H "X-Intake-Secret: $(echo $QUOTE_INTAKE_SECRET)" \
  -d '{"formId": "unique-id-123", "name": "Test", "email": "test@example.com", "serviceType": "residential"}'
```

Second request with the same `formId`:

Expected: `409 Conflict` with the existing `quoteId`.

## Pricing Configuration

Pricing defaults are stored as workspace configuration and are editable via the UI (`Settings → Pricing`).

### Default Pricing Config

```typescript
{
  baseResidentialPerSqFt: 0.12,           // per square foot
  baseResidentialMinimum: 180,            // minimum charge
  deepCleanMultiplier: 1.5,               // 1.5x residential
  moveInOutMultiplier: 1.75,              // 1.75x residential
  airbnbTurnoverFlat: {
    "1": 110,
    "2": 140,
    "3": 180,
    "4+": 220
  },
  commercialPerSqFt: 0.08,
  frequencyDiscount: {
    ONE_TIME: 0.00,
    WEEKLY: 0.15,       // 15% discount
    BI_WEEKLY: 0.10,    // 10% discount
    MONTHLY: 0.05       // 5% discount
  },
  addOns: {
    inside_fridge: { label: "Inside fridge", price: 30 },
    inside_oven: { label: "Inside oven", price: 30 },
    inside_cabinets: { label: "Inside cabinets", price: 60 },
    laundry: { label: "Laundry (1 load)", price: 25 },
    windows_interior: { label: "Interior windows", price: 50 },
    baseboards: { label: "Baseboards", price: 40 }
  },
  taxRate: 0.055        // 5.5% tax
}
```

## Workflow: From Intake to Quote

1. **Intake**: Website form on maineclean.co submits to the webhook.
2. **Validation**: Payload is validated with Zod. Contact info is normalized (email lowercase, phone to E.164).
3. **Deduplication**: If `formId` exists, return 409 with existing `quoteId`.
4. **Person/Company**: Upsert Person by normalized email or phone. If non-personal email domain, also upsert Company.
5. **Opportunity**: Create or link Opportunity, set stage to "New Lead", mark `intakeSource`.
6. **Quote**: Create Quote in `DRAFT` status:
   - Generate sequential `quoteNumber` (Q-YYYY-NNNN).
   - Seed `lineItems` via `PricingService.buildDefaultLineItems()`.
   - Calculate totals (subtotal, discount, tax).
   - Set `expiresAt = now + QUOTE_EXPIRATION_DAYS`.
   - Generate `approvalToken` for Spec 02 (SMS/email approval).
7. **Event**: Emit `QuoteCreatedEvent` for async actions (send notification to Megan).
8. **Response**: Return 200 with quote, person, and opportunity IDs.

Later specs will:
- **Spec 02**: Send quote via SMS/email with approval link.
- **Spec 03**: Capture approval & digital signature.
- **Spec 04**: Auto-schedule cleanings, iCal sync.
- **Spec 05**: Invoice generation & Stripe payment.

## Services

### PricingService

Calculates line items and totals based on pricing configuration.

**Key methods:**
- `buildDefaultLineItems(payload, pricingConfig)` — returns ordered line items (BASE → ADD_ON → DISCOUNT → TAX)
- `computeTotals(lineItems)` — recomputes totals from line items
- `recomputeQuoteTotals(lineItems)` — public-facing recompute

### IntakeService

Validates and normalizes intake payloads.

**Key methods:**
- `validateAndNormalizePayload(rawPayload)` — Zod validation
- `normalizeContact(payload)` — normalize email, phone, name
- `isPersonalEmail(email)` — check if email domain is personal or corporate

### QuoteService

Creates quotes from intake requests.

**Key methods:**
- `createFromIntake(input)` — build quote data with line items, totals, expiration, etc.
- `recomputeQuoteTotals(lineItems)` — recalculate totals when editing

### QuoteNumberService

Generates sequential quote numbers.

**Key methods:**
- `generateQuoteNumber(workspaceId)` — returns "Q-YYYY-NNNN"

## Environment Variables

```bash
QUOTE_INTAKE_SECRET=<generated-secret>
QUOTE_EXPIRATION_DAYS=30
QUOTE_DEFAULT_TAX_RATE=0.055
```

## Testing

Run unit tests:

```bash
npx jest src/modules/quote/services/pricing.service.spec.ts --config=packages/twenty-server/jest.config.mjs
npx jest src/modules/quote/services/intake.service.spec.ts --config=packages/twenty-server/jest.config.mjs
```

Integration tests (TODO):

```bash
npx jest src/modules/quote/controllers/intake-webhook.controller.e2e-spec.ts --config=packages/twenty-server/jest.config.mjs
```

## Security Considerations

1. **Constant-time secret comparison**: Prevents timing attacks.
2. **Rate limiting**: TODO — add rate limiting to webhook (e.g., 30/min per IP).
3. **PII in logs**: `intakeRawPayload` contains PII; restrict read access to workspace admins only.
4. **Idempotency**: `formId` prevents duplicate processing.
5. **Phone validation**: E.164 format enforced via `libphonenumber-js`.

## Integration with Quote Approval Module

The `quote-approval` module handles later stages (Spec 02-05):
- SMS approval via Twilio
- Stripe payment processing
- Invoice generation

The `QuoteCreatedEvent` emitted by this module can trigger workflows in `quote-approval`.

## Future Enhancements

- [ ] Spec 02: SMS/email with approval link
- [ ] Spec 03: Digital signature capture
- [ ] Spec 04: Auto-scheduling & iCal sync
- [ ] Spec 05: Invoicing & Stripe payment
- [ ] PDF generation for quote preview
- [ ] Discount code support
- [ ] Volume pricing tiers
