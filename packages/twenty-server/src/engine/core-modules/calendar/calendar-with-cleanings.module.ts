import { Module } from '@nestjs/common';

import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { CalendarWithCleaningsResolver } from 'src/engine/core-modules/calendar/resolvers/calendar-with-cleanings.resolver';
import { CalendarWithCleaningsService } from 'src/engine/core-modules/calendar/services/calendar-with-cleanings.service';

@Module({
  imports: [GlobalWorkspaceDataSourceModule],
  exports: [CalendarWithCleaningsService],
  providers: [CalendarWithCleaningsResolver, CalendarWithCleaningsService],
})
export class CalendarWithCleaningsModule {}
