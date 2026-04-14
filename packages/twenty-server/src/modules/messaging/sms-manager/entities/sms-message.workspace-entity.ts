import {
  FieldMetadataType,
  type ActorMetadata,
} from 'twenty-shared/types';

import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type SmsConversationWorkspaceEntity } from './sms-conversation.workspace-entity';
import { type PersonWorkspaceEntity } from 'src/modules/person/standard-objects/person.workspace-entity';

export class SmsMessageWorkspaceEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Conversation this message belongs to
  conversation: EntityRelation<SmsConversationWorkspaceEntity> | null;
  conversationId: string | null;

  // Who the message is with
  person: EntityRelation<PersonWorkspaceEntity> | null;
  personId: string | null;

  // Message content
  body: string;

  // Direction: INBOUND (from client) or OUTBOUND (from us)
  direction: 'INBOUND' | 'OUTBOUND';

  // Phone numbers
  fromPhoneNumber: string;
  toPhoneNumber: string;

  // Twilio SID for tracking
  twilioSid: string | null;

  // Status: pending, sent, failed, delivered, read
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';

  // Error message if failed
  errorMessage: string | null;

  // Custom fields
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
}
