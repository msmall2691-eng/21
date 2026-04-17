# Data Model Refactoring Guide

## Overview
This document explains the consolidation of redundant data models and the relationships between core entities.

---

## 1. Person vs Staff Member Clarification

### Old Model (Confusing)
```
person (CRM contact)
staff-member (team member)
├─ Two separate concepts
└─ Confusing when same person is both customer AND employee
```

### New Model (Recommended)
```
person (unified contact entity)
├─ person.type = 'CUSTOMER' | 'EMPLOYEE' | 'BOTH'
├─ person.role (if employee)
├─ person.department (if employee)
└─ Can link same person to both customer AND employee contexts

staff-member (DEPRECATED - merge into person)
└─ Functionality moved to person entity with flags
```

### Migration Steps
1. Query all staff-member records
2. Create corresponding person records if not exist
3. Link person → workspaceMember relationship
4. Add flags: isTeamMember: true, role: staff-member.role
5. Archive old staff-member records

### Implementation Notes
- PersonWorkspaceEntity should have optional fields:
  - `isTeamMember: boolean`
  - `role: string` ('admin' | 'manager' | 'technician' | etc)
  - `department: string`
  - `workspaceMemberId: string | null` (link to actual team member)

---

## 2. Activity Targets Consolidation

### Old Model (Duplicated)
```
note-target (links note to entity)
task-target (links task to entity)
├─ Duplicate schema
├─ Duplicate queries
└─ Confusing for new entities (SMS, email)
```

### New Model (Unified)
```
activity-target (links ANY activity to ANY entity)
├─ activityType: 'note' | 'task' | 'sms' | 'email'
├─ activityId: UUID (references note.id or task.id or sms.id, etc)
├─ person / company / opportunity (flexible linking)
└─ Supports future activities without schema changes
```

### Migration Steps
1. Create activity-target table
2. Migrate note-target → activity-target with activityType='note'
3. Migrate task-target → activity-target with activityType='task'
4. Update queries to use activity-target instead
5. Archive old note-target and task-target tables

### Query Examples

**Get all activities for a person:**
```sql
SELECT a.*, at.activityType 
FROM activity_target at
JOIN activity a ON a.id = at.activityId
WHERE at.personId = $1
ORDER BY a.createdAt DESC
```

**Get activities by type:**
```sql
SELECT * FROM activity_target 
WHERE activityType = 'sms'
AND personId = $1
```

---

## 3. Key Relationships After Refactoring

### Person Entity (Hub)
```
Person
├─ Conversations (Email, SMS)
├─ Activities (Notes, Tasks)
├─ Opportunities
├─ Contacts (person → contact_info)
└─ WorkspaceMember (if team member)
```

### JobVisit Entity
```
JobVisit
├─ ServiceAgreement (what work is being done)
├─ Property (where work is happening)
├─ StaffMember → Person (who is doing it)
├─ SmsConversation (for updates)
├─ ActivityTargets (notes, tasks about this job)
└─ CalendarEvent (sync to Google Calendar)
```

### Quote Entity
```
Quote
├─ QuoteRequest (original request)
├─ QuoteApproval (approval status)
├─ Invoice (payment tracking - NEW)
├─ ServiceAgreement (converts quote to work)
├─ Person (customer receiving quote)
└─ ActivityTargets (emails, notes about quote)
```

### Property Entity
```
Property
├─ Company (which company owns it)
├─ ServiceAgreements (active services)
├─ JobVisits (completed jobs)
├─ Contacts (tenants? property managers?)
└─ SmsConversations (property-specific communications)
```

---

## 4. Missing Relationships to Add

### ServiceAgreement Enhancements
```sql
ALTER TABLE service_agreement ADD COLUMN
  invoiceId UUID REFERENCES invoice(id),
  contractStartDate TIMESTAMP,
  contractEndDate TIMESTAMP,
  monthlyRate DECIMAL,
  paymentStatus 'PAID' | 'PENDING' | 'OVERDUE';
```

### Person Enhancements
```sql
ALTER TABLE person ADD COLUMN
  isTeamMember BOOLEAN DEFAULT false,
  role VARCHAR (for employees),
  department VARCHAR,
  workspaceMemberId UUID REFERENCES workspace_member(id);
```

### Property Enhancements
```sql
ALTER TABLE property ADD COLUMN
  companyId UUID REFERENCES company(id),
  squareFootage INT,
  unitCount INT,
  lastServiceDate TIMESTAMP,
  nextScheduledService TIMESTAMP;
```

---

## 5. New Invoice Model

See INVOICE_MODEL.md for detailed invoice implementation.

---

## Timeline
- Phase 1: Create activity-target entity + migrate note/task targets
- Phase 2: Enhance person entity with employee fields
- Phase 3: Update ServiceAgreement relationships
- Phase 4: Update Property relationships
- Phase 5: Archive deprecated tables (6 month grace period)

---

## Benefits After Refactoring

✅ Clearer data model
✅ No duplicate schemas
✅ Supports new activity types easily (SMS, email, calls)
✅ Person entity is true hub
✅ Relationships are explicit and testable
✅ Future-proof for CRM features

