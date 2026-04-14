import { Injectable, Logger } from '@nestjs/common';
import twilio from 'twilio';

import { ConfigService } from '@nestjs/config';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { type SmsConversationWorkspaceEntity } from '../entities/sms-conversation.workspace-entity';
import { type SmsMessageWorkspaceEntity } from '../entities/sms-message.workspace-entity';

export type SendSmsInput = {
  phoneNumber: string;
  personId: string;
  body: string;
  workspaceId: string;
};

export type ReceiveSmsInput = {
  fromPhoneNumber: string;
  toPhoneNumber: string;
  body: string;
  twilioSid: string;
  workspaceId: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: ReturnType<typeof twilio.Twilio> | null = null;
  private twilioPhoneNumber: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    this.initializeTwilio();
  }

  private initializeTwilio(): void {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const phoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (accountSid && authToken && phoneNumber) {
      this.twilioClient = twilio(accountSid, authToken);
      this.twilioPhoneNumber = phoneNumber;
      this.logger.log('Twilio SMS service initialized');
    } else {
      this.logger.warn('Twilio credentials not configured - SMS disabled');
    }
  }

  async sendSms(input: SendSmsInput): Promise<SmsMessageWorkspaceEntity> {
    if (!this.twilioClient || !this.twilioPhoneNumber) {
      throw new Error('Twilio SMS not configured');
    }

    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      // Send via Twilio
      const twilioMessage = await this.twilioClient.messages.create({
        body: input.body,
        from: this.twilioPhoneNumber,
        to: input.phoneNumber,
      });

      // Get or create conversation
      const smsConversationRepository =
        await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
          input.workspaceId,
          'smsConversation',
        );

      let conversation = await smsConversationRepository.findOne({
        where: {
          phoneNumber: input.phoneNumber,
          personId: input.personId,
        },
      });

      if (!conversation) {
        conversation = await smsConversationRepository.create({
          phoneNumber: input.phoneNumber,
          personId: input.personId,
          status: 'ACTIVE',
          messageCount: 0,
        });
      }

      // Save message to database
      const smsMessageRepository =
        await this.globalWorkspaceOrmManager.getRepository<SmsMessageWorkspaceEntity>(
          input.workspaceId,
          'smsMessage',
        );

      const savedMessage = await smsMessageRepository.create({
        conversationId: conversation.id,
        personId: input.personId,
        body: input.body,
        direction: 'OUTBOUND',
        fromPhoneNumber: this.twilioPhoneNumber,
        toPhoneNumber: input.phoneNumber,
        twilioSid: twilioMessage.sid,
        status: 'SENT',
      });

      // Update conversation
      await smsConversationRepository.update(conversation.id, {
        lastMessageAt: new Date().toISOString(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      this.logger.log(
        `SMS sent to ${input.phoneNumber} (Twilio SID: ${twilioMessage.sid})`,
      );

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${input.phoneNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async receiveSms(input: ReceiveSmsInput): Promise<SmsMessageWorkspaceEntity> {
    const authContext = buildSystemAuthContext(input.workspaceId);

    try {
      // Get or create conversation
      const smsConversationRepository =
        await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
          input.workspaceId,
          'smsConversation',
        );

      let conversation = await smsConversationRepository.findOne({
        where: {
          phoneNumber: input.fromPhoneNumber,
        },
      });

      if (!conversation) {
        conversation = await smsConversationRepository.create({
          phoneNumber: input.fromPhoneNumber,
          status: 'ACTIVE',
          messageCount: 0,
        });
      }

      // Save inbound message
      const smsMessageRepository =
        await this.globalWorkspaceOrmManager.getRepository<SmsMessageWorkspaceEntity>(
          input.workspaceId,
          'smsMessage',
        );

      const savedMessage = await smsMessageRepository.create({
        conversationId: conversation.id,
        personId: conversation.personId || null,
        body: input.body,
        direction: 'INBOUND',
        fromPhoneNumber: input.fromPhoneNumber,
        toPhoneNumber: input.toPhoneNumber,
        twilioSid: input.twilioSid,
        status: 'DELIVERED',
      });

      // Update conversation
      await smsConversationRepository.update(conversation.id, {
        lastMessageAt: new Date().toISOString(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      this.logger.log(
        `SMS received from ${input.fromPhoneNumber} (Twilio SID: ${input.twilioSid})`,
      );

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Failed to receive SMS from ${input.fromPhoneNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async linkPhoneToContact(
    workspaceId: string,
    phoneNumber: string,
    personId: string,
  ): Promise<void> {
    const smsConversationRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
        workspaceId,
        'smsConversation',
      );

    const conversation = await smsConversationRepository.findOne({
      where: { phoneNumber },
    });

    if (conversation) {
      await smsConversationRepository.update(conversation.id, {
        personId,
      });
      this.logger.log(
        `Linked phone ${phoneNumber} to person ${personId}`,
      );
    }
  }

  // GraphQL Query Methods
  async getConversations(
    workspaceId: string,
    filter?: any,
    orderBy?: any,
    first?: number,
  ): Promise<SmsConversationWorkspaceEntity[]> {
    const smsConversationRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
        workspaceId,
        'smsConversation',
      );

    try {
      return (
        (await smsConversationRepository.find({
          where: filter || {},
          order: orderBy?.length > 0 ? orderBy[0] : { lastMessageAt: 'DESC' },
          take: first || 20,
        })) || []
      );
    } catch (error) {
      this.logger.error(
        `Failed to get conversations: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getConversationById(
    conversationId: string,
    workspaceId: string,
  ): Promise<SmsConversationWorkspaceEntity | null> {
    const smsConversationRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
        workspaceId,
        'smsConversation',
      );

    try {
      return await smsConversationRepository.findOne({
        where: { id: conversationId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get conversation: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async getMessages(
    workspaceId: string,
    filter?: any,
    orderBy?: any,
    first?: number,
  ): Promise<SmsMessageWorkspaceEntity[]> {
    const smsMessageRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsMessageWorkspaceEntity>(
        workspaceId,
        'smsMessage',
      );

    try {
      return (
        (await smsMessageRepository.find({
          where: filter || {},
          order: orderBy?.length > 0 ? orderBy[0] : { createdAt: 'ASC' },
          take: first || 50,
        })) || []
      );
    } catch (error) {
      this.logger.error(
        `Failed to get messages: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getMessageById(
    messageId: string,
    workspaceId: string,
  ): Promise<SmsMessageWorkspaceEntity | null> {
    const smsMessageRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsMessageWorkspaceEntity>(
        workspaceId,
        'smsMessage',
      );

    try {
      return await smsMessageRepository.findOne({
        where: { id: messageId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get message: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async createConversation(input: {
    phoneNumber: string;
    personId?: string;
    workspaceId: string;
  }): Promise<SmsConversationWorkspaceEntity> {
    const smsConversationRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
        input.workspaceId,
        'smsConversation',
      );

    try {
      const existing = await smsConversationRepository.findOne({
        where: { phoneNumber: input.phoneNumber },
      });

      if (existing) {
        return existing;
      }

      const conversation = await smsConversationRepository.create({
        phoneNumber: input.phoneNumber,
        personId: input.personId || null,
        status: 'ACTIVE',
        messageCount: 0,
      });

      this.logger.log(`Created SMS conversation for ${input.phoneNumber}`);
      return conversation;
    } catch (error) {
      this.logger.error(
        `Failed to create conversation: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async updateConversationStatus(
    conversationId: string,
    status: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED',
    workspaceId: string,
  ): Promise<SmsConversationWorkspaceEntity> {
    const smsConversationRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
        workspaceId,
        'smsConversation',
      );

    try {
      const updated = await smsConversationRepository.update(conversationId, {
        status,
      });

      this.logger.log(`Updated conversation ${conversationId} status to ${status}`);
      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update conversation status: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async sendSmsFromConversation(input: {
    conversationId: string;
    body: string;
    workspaceId: string;
  }): Promise<SmsMessageWorkspaceEntity> {
    if (!this.twilioClient || !this.twilioPhoneNumber) {
      throw new Error('Twilio SMS not configured');
    }

    const smsConversationRepository =
      await this.globalWorkspaceOrmManager.getRepository<SmsConversationWorkspaceEntity>(
        input.workspaceId,
        'smsConversation',
      );

    try {
      const conversation = await smsConversationRepository.findOne({
        where: { id: input.conversationId },
      });

      if (!conversation) {
        throw new Error(`Conversation not found`);
      }

      const twilioMessage = await this.twilioClient.messages.create({
        body: input.body,
        from: this.twilioPhoneNumber,
        to: conversation.phoneNumber,
      });

      const smsMessageRepository =
        await this.globalWorkspaceOrmManager.getRepository<SmsMessageWorkspaceEntity>(
          input.workspaceId,
          'smsMessage',
        );

      const savedMessage = await smsMessageRepository.create({
        conversationId: input.conversationId,
        personId: conversation.personId || null,
        body: input.body,
        direction: 'OUTBOUND',
        fromPhoneNumber: this.twilioPhoneNumber,
        toPhoneNumber: conversation.phoneNumber,
        twilioSid: twilioMessage.sid,
        status: 'SENT',
      });

      await smsConversationRepository.update(input.conversationId, {
        lastMessageAt: new Date().toISOString(),
        messageCount: (conversation.messageCount || 0) + 1,
      });

      this.logger.log(
        `SMS sent from conversation (Twilio SID: ${twilioMessage.sid})`,
      );

      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Failed to send SMS: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
