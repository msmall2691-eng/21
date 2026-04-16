import {
  ForbiddenException,
  Logger,
  UseFilters,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';
import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { ConnectedAccountMetadataService } from 'src/engine/metadata-modules/connected-account/connected-account-metadata.service';
import { ScheduledMessageService } from 'src/modules/messaging/message-scheduler/scheduled-message.service';
import { ScheduleEmailInput } from 'src/modules/messaging/message-scheduler/dtos/schedule-email.input';
import { ScheduleEmailOutputDTO } from 'src/modules/messaging/message-scheduler/dtos/schedule-email-output.dto';

@MetadataResolver()
@UsePipes(ResolverValidationPipe)
@UseFilters(AuthGraphqlApiExceptionFilter)
@UseGuards(WorkspaceAuthGuard, NoPermissionGuard)
export class ScheduleEmailResolver {
  private readonly logger = new Logger(ScheduleEmailResolver.name);

  constructor(
    private readonly connectedAccountMetadataService: ConnectedAccountMetadataService,
    private readonly scheduledMessageService: ScheduledMessageService,
  ) {}

  @Mutation(() => ScheduleEmailOutputDTO)
  async scheduleEmail(
    @Args('input') input: ScheduleEmailInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<ScheduleEmailOutputDTO> {
    try {
      // Verify ownership of connected account
      await this.connectedAccountMetadataService.verifyOwnership({
        id: input.connectedAccountId,
        userWorkspaceId,
        workspaceId: workspace.id,
      });

      const scheduledAt = new Date(input.scheduledAt);

      // Schedule the email
      await this.scheduledMessageService.scheduleEmail(
        {
          connectedAccountId: input.connectedAccountId,
          to: input.to,
          subject: input.subject,
          body: input.body,
          inReplyTo: input.inReplyTo,
        },
        userWorkspaceId,
        workspace.id,
        input.connectedAccountId,
        scheduledAt,
      );

      return {
        success: true,
        jobId: `scheduled-${Date.now()}`,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to schedule email: ${error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule email',
      };
    }
  }
}
