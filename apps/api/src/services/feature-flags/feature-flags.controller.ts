import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FeatureFlagsService, FeatureFlagTarget } from './feature-flags.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleBasedGuard } from '../../common/guards/role-based.guard';

@Controller('api/admin/feature-flags')
@UseGuards(RoleBasedGuard)
@Roles('ADMIN')
export class FeatureFlagsController {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  @Get()
  async getAllFlags() {
    return this.featureFlagsService.getAllFlags();
  }

  @Get(':name')
  async getFlag(@Param('name') name: string) {
    return this.featureFlagsService.getFlag(name);
  }

  @Post()
  async createFlag(
    @Body()
    dto: {
      name: string;
      isEnabled: boolean;
      rolloutPercentage: number;
      targetAudience?: FeatureFlagTarget;
    },
  ) {
    return this.featureFlagsService.createFlag(
      dto.name,
      dto.isEnabled,
      dto.rolloutPercentage,
      dto.targetAudience,
    );
  }

  @Patch(':name')
  async updateFlag(
    @Param('name') name: string,
    @Body()
    dto: {
      isEnabled?: boolean;
      rolloutPercentage?: number;
      targetAudience?: FeatureFlagTarget;
    },
  ) {
    return this.featureFlagsService.updateFlag(name, dto);
  }

  @Delete(':name')
  async deleteFlag(@Param('name') name: string) {
    await this.featureFlagsService.deleteFlag(name);
    return { success: true, message: `Feature flag '${name}' deleted` };
  }

  @Get(':name/stats')
  async getStats(@Param('name') name: string) {
    return this.featureFlagsService.getRolloutStats(name);
  }
}
