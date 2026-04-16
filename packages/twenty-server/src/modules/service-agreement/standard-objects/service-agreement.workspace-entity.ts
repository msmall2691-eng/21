import {
  FieldMetadataType,
  type ActorMetadata,
  type CurrencyMetadata,
} from 'twenty-shared/types';

import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_SERVICE_AGREEMENT: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export class ServiceAgreementWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  name: string | null;
  serviceType: string | null;
  frequency: string | null;
  price: CurrencyMetadata | null;
  startDate: string | null;
  endDate: string | null;
  scope: string | null;
  isActive: boolean;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  // Customer relationship (who pays for this agreement)
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;

  property: EntityRelation<PropertyWorkspaceEntity> | null;
  propertyId: string | null;
  jobVisits: EntityRelation<JobVisitWorkspaceEntity[]>;
}
