import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
  controllers: [FeatureFlagsController],
})
export class FeatureFlagsModule {}
