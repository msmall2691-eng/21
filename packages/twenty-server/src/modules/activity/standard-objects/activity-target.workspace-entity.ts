import {
  FieldMetadataType,
  type ActorMetadata,
} from 'twenty-shared/types';

import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';
import { type CompanyWorkspaceEntity } from 'src/modules/company/standard-objects/company.workspace-entity';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';

/**
 * Consolidated ActivityTarget replaces both note-target and task-target.
 * Links any activity (note, task, SMS, email) to the relevant entity.
 *
 * Supports linking to: Person, Company, Opportunity, or other record types.
 */
export class ActivityTargetWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Type of activity this target belongs to
  // Examples: 'note', 'task', 'sms', 'email'
  activityType: string;

  // ID of the activity (note ID, task ID, SMS message ID, etc.)
  activityId: string;

  // Primary target: person
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;

  // Secondary target: company
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;

  // Tertiary target: opportunity
  opportunity: EntityRelation<OpportunityWorkspaceEntity> | null;
  opportunityId: string | null;

  // Allow linking to any object by generic metadata ID
  // For flexibility if we want to link to other entities in the future
  targetObjectMetadataId: string | null;
  targetRecordId: string | null;

  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
}
