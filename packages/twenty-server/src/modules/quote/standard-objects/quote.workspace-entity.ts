import {
  FieldMetadataType,
  type ActorMetadata,
  type CurrencyMetadata,
} from 'twenty-shared/types';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type AttachmentWorkspaceEntity } from 'src/modules/attachment/standard-objects/attachment.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';

const NAME_FIELD_NAME = 'quoteNumber';

export const SEARCH_FIELDS_FOR_QUOTE: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export type QuoteLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  kind: 'BASE' | 'ADD_ON' | 'DISCOUNT' | 'TAX' | 'CUSTOM';
};

export type ServiceAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export type QuoteStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'DECLINED' | 'EXPIRED';
export type ServiceType =
  | 'RESIDENTIAL'
  | 'DEEP_CLEAN'
  | 'MOVE_IN_OUT'
  | 'AIRBNB_TURNOVER'
  | 'COMMERCIAL'
  | 'OTHER';
export type FrequencyType = 'ONE_TIME' | 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY';

export class QuoteWorkspaceEntity extends BaseWorkspaceEntity {
  quoteNumber: string;
  status: string; // QuoteStatus enum as string
  serviceAddress: ServiceAddress | null;
  serviceType: string; // ServiceType enum as string
  frequency: string; // FrequencyType enum as string
  squareFeet: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  estimatedHours: number | null;
  lineItems: QuoteLineItem[] | null; // JSONB array
  subtotal: CurrencyMetadata | null;
  discountTotal: CurrencyMetadata | null;
  taxTotal: CurrencyMetadata | null;
  total: CurrencyMetadata | null;
  currency: string; // default 'USD'
  customerNotes: string | null;
  internalNotes: string | null;
  intakeRawPayload: Record<string, unknown> | null; // JSONB
  intakeSource: string | null;
  externalFormId: string | null;
  expiresAt: Date | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  approvalToken: string | null;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  // Relations
  person: EntityRelation<PersonWorkspaceEntity>;
  personId: string;
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;
  opportunity: EntityRelation<OpportunityWorkspaceEntity>;
  opportunityId: string;
  attachments: EntityRelation<AttachmentWorkspaceEntity[]>;
  timelineActivities: EntityRelation<TimelineActivityWorkspaceEntity[]>;
}
