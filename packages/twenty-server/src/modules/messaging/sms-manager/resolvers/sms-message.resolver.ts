import { Args, Query, Resolver, Mutation } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { AuthContext } from 'src/engine/decorators/auth/auth-context.decorator';
import { AuthContextType } from 'src/engine/types/auth-context.type';
import { SmsService } from '../services/sms.service';

@Resolver('SmsMessage')
@UseGuards(JwtAuthGuard)
export class SmsMessageResolver {
  constructor(private readonly smsService: SmsService) {}

  @Query('smsMessages')
  async getSmsMessages(
    @AuthContext() authContext: AuthContextType,
    @Args('filter') filter?: any,
    @Args('orderBy') orderBy?: any,
    @Args('first') first?: number,
    @Args('after') after?: string,
  ) {
    const workspaceId = authContext.workspace.id;

    const messages = await this.smsService.getMessages(
      workspaceId,
      filter,
      orderBy,
      first,
      after,
    );

    return {
      edges: messages.map((message) => ({
        node: message,
        cursor: Buffer.from(message.id).toString('base64'),
      })),
      pageInfo: {
        hasNextPage: (messages?.length || 0) >= (first || 50),
        hasPreviousPage: !!after,
        startCursor: messages?.[0]
          ? Buffer.from(messages[0].id).toString('base64')
          : null,
        endCursor: messages?.[messages.length - 1]
          ? Buffer.from(messages[messages.length - 1].id).toString('base64')
          : null,
      },
    };
  }

  @Query('smsMessage')
  async getSmsMessage(
    @AuthContext() authContext: AuthContextType,
    @Args('id') id: string,
  ) {
    return await this.smsService.getMessageById(id, authContext.workspace.id);
  }

  @Mutation('sendSmsMessage')
  async sendSmsMessage(
    @AuthContext() authContext: AuthContextType,
    @Args('input')
    input: {
      conversationId: string;
      body: string;
    },
  ) {
    const { conversationId, body } = input;

    return await this.smsService.sendSmsFromConversation({
      conversationId,
      body,
      workspaceId: authContext.workspace.id,
    });
  }

  @Mutation('createSmsConversation')
  async createSmsConversation(
    @AuthContext() authContext: AuthContextType,
    @Args('input')
    input: {
      phoneNumber: string;
      personId?: string;
    },
  ) {
    const { phoneNumber, personId } = input;

    return await this.smsService.createConversation({
      phoneNumber,
      personId,
      workspaceId: authContext.workspace.id,
    });
  }

  @Mutation('updateSmsConversation')
  async updateSmsConversation(
    @AuthContext() authContext: AuthContextType,
    @Args('input')
    input: {
      id: string;
      status?: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
    },
  ) {
    const { id, status } = input;

    return await this.smsService.updateConversationStatus(
      id,
      status,
      authContext.workspace.id,
    );
  }

  @Mutation('archiveSmsConversation')
  async archiveSmsConversation(
    @AuthContext() authContext: AuthContextType,
    @Args('conversationId') conversationId: string,
  ) {
    return await this.smsService.updateConversationStatus(
      conversationId,
      'ARCHIVED',
      authContext.workspace.id,
    );
  }

  @Mutation('blockSmsConversation')
  async blockSmsConversation(
    @AuthContext() authContext: AuthContextType,
    @Args('conversationId') conversationId: string,
  ) {
    return await this.smsService.updateConversationStatus(
      conversationId,
      'BLOCKED',
      authContext.workspace.id,
    );
  }
}
