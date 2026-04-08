import { Module } from '@nestjs/common';

import { CalendarWithCleaningsResolver } from 'src/engine/core-modules/calendar/resolvers/calendar-with-cleanings.resolver';
import { CalendarWithCleaningsService } from 'src/engine/core-modules/calendar/services/calendar-with-cleanings.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

@Module({
  imports: [],
  exports: [CalendarWithCleaningsService],
  providers: [CalendarWithCleaningsResolver, CalendarWithCleaningsService, GlobalWorkspaceOrmManager],
})
export class CalendarWithCleaningsModule {}
