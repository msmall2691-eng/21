import { UseGuards } from '@nestjs/common';
import { Args, ArgsType, Field, Query } from '@nestjs/graphql';

import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { CalendarWithCleaningsResponseDTO } from 'src/engine/core-modules/calendar/dtos/calendar-with-cleanings.dto';
import { CalendarWithCleaningsService } from 'src/engine/core-modules/calendar/services/calendar-with-cleanings.service';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { CoreResolver } from 'src/engine/api/graphql/graphql-config/decorators/core-resolver.decorator';
import { CustomPermissionGuard } from 'src/engine/guards/custom-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@ArgsType()
class GetCalendarWithCleaningsArgs {
  @Field()
  @IsISO8601()
  startDate: string;

  @Field()
  @IsISO8601()
  endDate: string;

  @Field(() => [UUIDScalarType], { nullable: true })
  @IsOptional()
  @IsUUID('4', { each: true })
  propertyIds?: string[];
}

@UseGuards(WorkspaceAuthGuard, CustomPermissionGuard)
@CoreResolver(() => CalendarWithCleaningsResponseDTO)
export class CalendarWithCleaningsResolver {
  constructor(
    private readonly calendarWithCleaningsService: CalendarWithCleaningsService,
  ) {}

  @Query(() => CalendarWithCleaningsResponseDTO)
  async getCalendarWithCleanings(
    @Args() { startDate, endDate, propertyIds }: GetCalendarWithCleaningsArgs,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<CalendarWithCleaningsResponseDTO> {
    return this.calendarWithCleaningsService.getCalendarWithCleanings({
      workspaceId: workspace.id,
      startDate,
      endDate,
      propertyIds,
    });
  }
}
