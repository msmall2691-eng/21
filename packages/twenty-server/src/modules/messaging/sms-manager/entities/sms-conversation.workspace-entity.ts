import {
  FieldMetadataType,
  type ActorMetadata,
} from 'twenty-shared/types';

import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export class SmsConversationWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Phone number being communicated with
  phoneNumber: string;

  // Person this conversation is with
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;

  // Last message timestamp for sorting
  lastMessageAt: string | null;

  // Conversation status: active, archived, blocked
  status: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';

  // Message count
  messageCount: number;

  // Custom fields
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
}
