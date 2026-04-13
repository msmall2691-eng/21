# Lead Capture from Email Module

Automatically detect cleaning service requests in incoming emails and convert them to CRM opportunities.

## Overview

When a customer emails asking about cleaning services, this module:
1. **Detects** the cleaning request (keyword matching + confidence scoring)
2. **Extracts** contact info, service type, property details (bedrooms, sq ft, address)
3. **Creates** a Person record (if new contact)
4. **Creates** an Opportunity linked to that person
5. **Links** the email thread to the opportunity for easy reference

No manual data entry — leads flow straight from email inbox into your pipeline.

## Architecture

```
Incoming Email
    ↓
LeadExtractionService (analyze content)
    ↓ (if confidence > 30%)
EmailToOpportunityService (prepare opportunity data)
    ↓
Job Processor (create Person + Opportunity + link email)
    ↓
Dashboard (review + take action)
```

## How It Works

### 1. Email Analysis

`LeadExtractionService.extractLeadData()` analyzes email for:

**Keywords Detected:**
- "cleaning", "clean", "maid", "janitorial", "housekeeping"
- "deep clean", "move-in", "move out", "turnover"
- "airbnb", "carpet", "office", "commercial"

**Data Extracted:**
- **Service Type**: RESIDENTIAL, DEEP_CLEAN, MOVE_IN_OUT, AIRBNB_TURNOVER, COMMERCIAL
- **Frequency**: ONE_TIME, WEEKLY, BI_WEEKLY, MONTHLY
- **Property Details**: bedrooms, bathrooms, square feet
- **Contact Info**: phone number (E.164), address
- **Confidence Score**: 0-1 (how confident this is a real lead)

### 2. Example Email → Extracted Data

**Email:**
```
Subject: Need cleaning service

Body: Hi, I have a 3 bedroom, 2 bathroom house with about 1800 sq ft.
I need weekly residential cleaning. My address is 123 Main Street,
Portland, ME 04101. You can reach me at (207) 555-1212.
```

**Extracted:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+12075551212",
  "serviceType": "RESIDENTIAL",
  "requestedFrequency": "WEEKLY",
  "address": "123 Main Street",
  "bedrooms": 3,
  "bathrooms": 2,
  "estimatedSquareFeet": 1800,
  "confidence": 0.85
}
```

### 3. Confidence Scoring

Leads are created if confidence ≥ 30% (configurable).

**Confidence Factors:**
- Contains cleaning keyword: +40%
- Service type identified: +20%
- Phone number provided: +15%
- Address provided: +15%
- Property details (beds/baths/sqft): +10%

Example scores:
- ✅ Full details (keywords + phone + address + details) = ~90% → **Create**
- ✅ Partial (keywords + phone) = ~55% → **Create**
- ⚠️ Minimal (keywords only) = ~40% → **Create** (but review)
- ❌ No keywords = 0% → **Skip**

## Usage

### Manual Integration

If you're building a custom job/handler to process emails:

```typescript
import { 
  LeadExtractionService, 
  EmailToOpportunityService 
} from 'src/modules/lead-capture-from-email';

@Injectable()
export class ProcessEmailJob {
  constructor(
    private leadExtraction: LeadExtractionService,
    private emailToOpp: EmailToOpportunityService,
  ) {}

  async processNewEmail(
    senderEmail: string,
    senderName: string,
    subject: string,
    body: string,
  ) {
    // Analyze the email
    const analysis = await this.emailToOpp.analyzeEmailForOpportunity(
      senderEmail,
      senderName,
      subject,
      body,
    );

    if (!analysis.shouldCreateOpportunity) {
      console.log(`Skipped: ${analysis.reason}`);
      return;
    }

    // Extract data
    const leadData = analysis.leadData;
    console.log(`Lead detected: ${leadData.confidence * 100}% confidence`);

    // TODO: Upsert Person by email
    // TODO: Create Opportunity with analysis.leadData
    // TODO: Link MessageThread to Opportunity
    // TODO: Send notification to Megan
  }
}
```

### Integration with Message Sync

To automatically process new emails as they arrive:

**Option 1: BullMQ Job (Recommended)**
```typescript
// Create a job handler in src/modules/messaging/jobs/
export class ProcessNewEmailLeadsJob {
  @InjectQueue(PROCESS_EMAIL_LEADS_QUEUE)
  private queue: Queue;

  async onNewMessages(threadIds: string[]) {
    for (const threadId of threadIds) {
      await this.queue.add('process-thread', { threadId });
    }
  }

  async processEmailThread(threadId: string) {
    // Load thread with messages
    const thread = await this.messageService.getThread(threadId);
    
    // Get sender + subject + latest message body
    const analysis = await this.emailToOpp.analyzeEmailForOpportunity(...);
    
    if (analysis.shouldCreateOpportunity) {
      // Create Person + Opportunity + Link
    }
  }
}
```

**Option 2: Event Listener (Simpler)**
```typescript
@EventListener()
async onMessageImported(event: MessageImportedEvent) {
  // Check if this is the first message in a thread
  // If yes, analyze for leads
  
  const analysis = await this.emailToOpp.analyzeEmailForOpportunity(
    event.senderEmail,
    event.senderName,
    event.subject,
    event.body,
  );
  
  if (analysis.shouldCreateOpportunity) {
    // Create opportunity
  }
}
```

## Services

### LeadExtractionService

Analyzes email content and extracts structured data.

**Methods:**
- `extractLeadData(email, name, subject, body)` → `ExtractedLeadData`
  - Detects cleaning keywords
  - Extracts service type, frequency, property details
  - Calculates confidence score
  - Returns all extracted data

### EmailToOpportunityService

Converts extracted lead data into opportunity data.

**Methods:**
- `analyzeEmailForOpportunity(email, name, subject, body)` → analysis result
  - Calls LeadExtractionService
  - Returns { shouldCreateOpportunity, leadData, reason }
  - Use confidence threshold to decide

- `buildOpportunityData(leadData, personId)` → opportunity object
  - Prepares data for opportunity creation
  - Sets stage to "New Lead"
  - Uses confidence as probability %
  - Includes extracted data in description + metadata

## Testing

Run unit tests:

```bash
npx jest src/modules/lead-capture-from-email/services/lead-extraction.service.spec.ts \
  --config=packages/twenty-server/jest.config.mjs
```

Test cases cover:
- ✅ Cleaning keyword detection (residential, deep clean, move-in, Airbnb, commercial)
- ✅ Service type identification
- ✅ Frequency extraction (weekly, bi-weekly, monthly, one-time)
- ✅ Phone number parsing (multiple formats)
- ✅ Property details (bedrooms, bathrooms, square feet)
- ✅ Address extraction
- ✅ Confidence scoring
- ✅ Non-cleaning email filtering

## Configuration

**Min Confidence Threshold:**
```typescript
private readonly MIN_CONFIDENCE_TO_CREATE = 0.3; // 30%
```

Adjust in `EmailToOpportunityService` constructor to be more/less strict:
- `0.3` = More leads, some false positives (lower quality)
- `0.5` = Balanced (recommended)
- `0.7` = Only high-confidence leads (fewer false positives)

**Cleaning Keywords:**
```typescript
private readonly CLEANING_KEYWORDS = [
  'cleaning', 'clean', 'maid', 'janitorial', 'housekeeping',
  'deep clean', 'move-in', 'move out', 'turnover',
  'airbnb', 'carpet', 'office clean', 'commercial clean', ...
];
```

Update in `LeadExtractionService` to tune detection.

## Important: Always Create NEW Client Records

**This module creates a NEW Person record for every email**, even if that email address already exists in the CRM.

Why? Megan wants to see every inbound lead independently, without auto-linking to existing customers. This allows her to:
- ✅ Review each inquiry separately (context matters)
- ✅ Manually deduplicate if it's a known customer re-inquiring
- ✅ Distinguish between "repeat customer" vs "new prospect"
- ✅ Track multiple inquiries from same person for different properties

**Implementation note:**
When building the job processor, ALWAYS use:
```typescript
// Create new Person (don't upsert by email)
const newPerson = await personService.create({
  email: leadData.email,
  phone: leadData.phone,
  name: leadData.name,
  createdFromEmailLead: true,  // tag for filtering
});

// Create Opportunity
const newOpp = await opportunityService.create({
  personId: newPerson.id,
  // ... other fields
});

// Link MessageThread to Opportunity
await messageThreadService.update(threadId, {
  opportunityId: newOpp.id,
});
```

## Workflow: Email → Quote → Payment

```
1. Customer emails → Lead Capture detects → NEW Opportunity + Person created
         ↓
2. Megan reviews in CRM (can see all email inquiries)
         ↓
3. If existing customer: manually merge Person records
         ↓
4. If new prospect: proceed with quote
         ↓
5. Clicks "Send Quote" (Spec 01) → Draft Quote created
         ↓
6. Sends SMS/email with approval link (Spec 02)
         ↓
7. Customer approves via link
         ↓
8. Payment captured via Stripe (Spec 05)
         ↓
9. Cleaning scheduled (Spec 04) → Invoice sent
```

## Data Flow

**In MessageThread:**
- Add field: `opportunityId` (nullable)
- When lead is created, set `messageThread.opportunityId = createdOpportunity.id`

**In Opportunity:**
- Set stage to "New Lead"
- Set probability based on email confidence (e.g., 85% confidence = 85% probability)
- Include extracted details in description
- Store source as "email"

**In Person:**
- Create from email sender (email, phone, name)
- Mark as "Lead" vs "Customer"

## Security & Privacy

- ✅ No PII in logs (except during explicit debugging)
- ✅ Email content not stored after analysis (only in MessageThread)
- ✅ Confidence scoring reduces spam false positives
- ✅ Manual review recommended for confidence < 50%

## Future Enhancements

- [ ] AI/ML classification (instead of keyword matching)
- [ ] Sentiment analysis (detect "needs help" vs "curiosity")
- [ ] Auto-classify lead quality (hot/warm/cold)
- [ ] Duplicate detection (same person emailed multiple times)
- [ ] Auto-populate quote with extracted property details
- [ ] Webhook to external lead scoring system

## Troubleshooting

**Leads not being created?**
- Check confidence threshold (default 30%)
- Verify email contains cleaning keywords
- Check logs for MIN_CONFIDENCE_TO_CREATE filter

**Too many false positives?**
- Increase MIN_CONFIDENCE_TO_CREATE to 0.5 or 0.7
- Review extracted keywords and adjust list
- Implement additional filters (e.g., must have phone OR address)

**Missing property details?**
- Add more regex patterns for bedroom/bathroom/square feet detection
- Handle regional variations ("sq ft" vs "sqft" vs "square feet")

## SMS & Email Capabilities

**Yes! You can SMS and email customers directly from Twenty.**

### 📧 Email (Built-In)

**Sending emails:**
1. Go to any **Person** or **Opportunity** record
2. Scroll to **Emails** widget
3. Click **Compose**
4. Write email → Send

**Viewing emails:**
- All incoming emails automatically synced from Gmail
- **Emails** widget shows full thread history
- Click to read, reply inline

**Requirements:**
- Gmail account connected (Settings → Connected Accounts)
- Oauth enabled on Railway (MESSAGING_PROVIDER_GMAIL_ENABLED=true)

### 💬 SMS (Via Twilio)

**Sending SMS:**
- Built into the quote-approval module (Spec 02)
- Send approval links via SMS
- Customers reply "YES" to approve
- Webhook processes replies

**Requirements:**
- Twilio account + credentials set on Railway:
  ```
  TWILIO_ACCOUNT_SID=xxx
  TWILIO_AUTH_TOKEN=xxx
  TWILIO_PHONE_NUMBER=+1234567890
  ```

**How it works:**
1. Create quote (Spec 01) → generates approval token
2. Click "Send for Approval" → sends SMS with link
3. Customer clicks link OR replies "YES"
4. Stripe payment page opens
5. Payment captured → Cleaning scheduled

---

## Integration Checklist for Megan

- [ ] **Email**: Gmail OAuth credentials set on Railway
- [ ] **SMS**: Twilio account created + credentials on Railway
- [ ] **Email leads**: Job processor built to link emails to opportunities
- [ ] **Test flow**: Email → Lead created → Quote sent → SMS approval → Payment

## References

- **Spec 01**: Quote intake webhook
- **Spec 02**: SMS/email quote approval (uses Twilio)
- **Spec 03**: Digital signature capture
- **Spec 04**: Cleaning scheduling
- **Spec 05**: Invoice + Stripe payment
- **Quote Approval Module**: `src/modules/quote-approval/` (handles SMS + Stripe)
