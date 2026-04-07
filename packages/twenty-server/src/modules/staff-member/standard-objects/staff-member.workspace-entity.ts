import {
  FieldMetadataType,
  type ActorMetadata,
  type EmailsMetadata,
  type FullNameMetadata,
  type PhonesMetadata,
} from 'twenty-shared/types';

import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_STAFF_MEMBER: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.FULL_NAME },
];

export class StaffMemberWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  name: FullNameMetadata | null;
  email: EmailsMetadata;
  phone: PhonesMetadata;
  role: string | null;
  connecteamId: string | null;
  isActive: boolean;
  hireDate: string | null;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  jobVisits: EntityRelation<JobVisitWorkspaceEntity[]>;
}
