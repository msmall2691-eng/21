import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnknownSenderLeadCreatorService } from './unknown-sender-lead-creator.service';
import { UnknownSenderListener } from './unknown-sender.listener';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  providers: [UnknownSenderLeadCreatorService, UnknownSenderListener],
  exports: [UnknownSenderLeadCreatorService],
})
export class UnknownSenderManagerModule {}
