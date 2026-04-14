import { Args, Query, Resolver, Parent, ResolveField } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from 'src/engine/guards/jwt.auth.guard';
import { AuthContext } from 'src/engine/decorators/auth/auth-context.decorator';
import { AuthContextType } from 'src/engine/types/auth-context.type';
import { SmsService } from '../services/sms.service';
import { SmsConversationWorkspaceEntity } from '../entities/sms-conversation.workspace-entity';
import { SmsMessageWorkspaceEntity } from '../entities/sms-message.workspace-entity';

@Resolver('SmsConversation')
@UseGuards(JwtAuthGuard)
export class SmsConversationResolver {
  constructor(private readonly smsService: SmsService) {}

  @Query('smsConversations')
  async getSmsConversations(
    @AuthContext() authContext: AuthContextType,
    @Args('filter') filter?: any,
    @Args('orderBy') orderBy?: any,
    @Args('first') first?: number,
    @Args('after') after?: string,
  ) {
    const workspaceId = authContext.workspace.id;

    const conversations = await this.smsService.getConversations(
      workspaceId,
      filter,
      orderBy,
      first,
      after,
    );

    return {
      edges: conversations.map((conversation) => ({
        node: conversation,
        cursor: Buffer.from(conversation.id).toString('base64'),
      })),
      pageInfo: {
        hasNextPage: (conversations?.length || 0) >= (first || 20),
        hasPreviousPage: !!after,
        startCursor: conversations?.[0]
          ? Buffer.from(conversations[0].id).toString('base64')
          : null,
        endCursor: conversations?.[conversations.length - 1]
          ? Buffer.from(conversations[conversations.length - 1].id).toString(
              'base64',
            )
          : null,
      },
    };
  }

  @Query('smsConversation')
  async getSmsConversation(
    @AuthContext() authContext: AuthContextType,
    @Args('id') id: string,
  ) {
    const workspaceId = authContext.workspace.id;
    return await this.smsService.getConversationById(id, workspaceId);
  }
}
