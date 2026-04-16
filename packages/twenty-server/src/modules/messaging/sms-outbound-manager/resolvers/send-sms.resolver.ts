import { Logger, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';
import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { SmsOutboundService } from 'src/modules/messaging/sms-outbound-manager/services/sms-outbound.service';
import { SendSmsInput } from 'src/modules/messaging/sms-outbound-manager/dtos/send-sms.input';
import { SendSmsOutputDTO } from 'src/modules/messaging/sms-outbound-manager/dtos/send-sms-output.dto';

@MetadataResolver()
@UsePipes(ResolverValidationPipe)
@UseFilters(AuthGraphqlApiExceptionFilter)
@UseGuards(WorkspaceAuthGuard, NoPermissionGuard)
export class SendSmsResolver {
  private readonly logger = new Logger(SendSmsResolver.name);

  constructor(private readonly smsOutboundService: SmsOutboundService) {}

  @Mutation(() => SendSmsOutputDTO)
  async sendSMS(
    @Args('input') input: SendSmsInput,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<SendSmsOutputDTO> {
    try {
      this.logger.log(`Sending SMS to ${input.to}`);

      const result = await this.smsOutboundService.sendSMS({
        to: input.to,
        body: input.body,
        inReplyTo: input.inReplyTo,
      });

      return {
        success: result.success,
        messageSid: result.messageSid,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  }
}
