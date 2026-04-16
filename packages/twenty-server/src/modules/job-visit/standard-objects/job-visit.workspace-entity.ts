import {
  FieldMetadataType,
  type ActorMetadata,
} from 'twenty-shared/types';

import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type CalendarEventWorkspaceEntity } from 'src/modules/calendar/common/standard-objects/calendar-event.workspace-entity';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';
import { type ServiceAgreementWorkspaceEntity } from 'src/modules/service-agreement/standard-objects/service-agreement.workspace-entity';
import { type StaffMemberWorkspaceEntity } from 'src/modules/staff-member/standard-objects/staff-member.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_JOB_VISIT: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export type JobVisitStatus =
  | 'SCHEDULED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export class JobVisitWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  name: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  status: JobVisitStatus | null;
  duration: number | null;
  notes: string | null;
  checklistCompleted: boolean;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  property: EntityRelation<PropertyWorkspaceEntity> | null;
  propertyId: string | null;
  serviceAgreement: EntityRelation<ServiceAgreementWorkspaceEntity> | null;
  serviceAgreementId: string | null;
  staffMember: EntityRelation<StaffMemberWorkspaceEntity> | null;
  staffMemberId: string | null;
  calendarEvent: EntityRelation<CalendarEventWorkspaceEntity> | null;
  calendarEventId: string | null;
}
