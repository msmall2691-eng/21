import {
  FieldMetadataType,
  type ActorMetadata,
  type AddressMetadata,
  type LinksMetadata,
} from 'twenty-shared/types';

import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type JobVisitWorkspaceEntity } from 'src/modules/job-visit/standard-objects/job-visit.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type QuoteRequestWorkspaceEntity } from 'src/modules/quote-request/standard-objects/quote-request.workspace-entity';
import { type ServiceAgreementWorkspaceEntity } from 'src/modules/service-agreement/standard-objects/service-agreement.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_PROPERTY: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export class PropertyWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  name: string | null;
  address: AddressMetadata;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  accessNotes: string | null;
  icalSyncUrl: LinksMetadata | null;
  isActive: boolean;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;
  serviceAgreements: EntityRelation<ServiceAgreementWorkspaceEntity[]>;
  jobVisits: EntityRelation<JobVisitWorkspaceEntity[]>;
  quoteRequests: EntityRelation<QuoteRequestWorkspaceEntity[]>;
}
