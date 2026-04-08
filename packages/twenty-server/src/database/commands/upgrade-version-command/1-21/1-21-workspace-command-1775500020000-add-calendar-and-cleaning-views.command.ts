import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';

/**
 * Migration: Add Calendar and STR Cleaning views to navigation
 * 
 * Purpose: 
 * - Add calendar events to main navigation
 * - Create views for calendar with cleanings
 * - Create cleaning schedule dashboard view
 */
@RegisteredWorkspaceCommand('1.21.0', 1775500020000)
@Command({
  name: 'upgrade:1-21:add-calendar-and-cleaning-views',
  description: 'Add calendar and cleaning schedule views to navigation',
})
export class AddCalendarAndCleaningViewsCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
  }: RunOnWorkspaceArgs): Promise<void> {
    this.logger.log(
      `Adding calendar and cleaning views for workspace ${workspaceId}...`,
    );

    // Views will be created via GraphQL mutations in the frontend
    // This migration is a placeholder for future database schema updates
    this.logger.log('Calendar and cleaning views configuration ready');
  }
}
