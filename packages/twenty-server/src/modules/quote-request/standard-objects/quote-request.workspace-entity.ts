import {
  FieldMetadataType,
  type ActorMetadata,
  type CurrencyMetadata,
} from 'twenty-shared/types';

import { type FieldTypeAndNameMetadata } from 'src/engine/workspace-manager/utils/get-ts-vector-column-expression.util';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type PropertyWorkspaceEntity } from 'src/modules/property/standard-objects/property.workspace-entity';
import { type QuoteWorkspaceEntity } from 'src/modules/quote/standard-objects/quote.workspace-entity';

const NAME_FIELD_NAME = 'name';

export const SEARCH_FIELDS_FOR_QUOTE_REQUEST: FieldTypeAndNameMetadata[] = [
  { name: NAME_FIELD_NAME, type: FieldMetadataType.TEXT },
];

export class QuoteRequestWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  name: string | null;
  requestDate: string | null;
  desiredStartDate: string | null;
  serviceType: string | null;
  frequency: string | null;
  estimatedPrice: CurrencyMetadata | null;
  stage: string | null;
  notes: string | null;
  position: number;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  searchVector: string;

  property: EntityRelation<PropertyWorkspaceEntity> | null;
  propertyId: string | null;
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;

  // Link to the Quote generated from this request
  quote: EntityRelation<QuoteWorkspaceEntity> | null;
  quoteId: string | null;
}
