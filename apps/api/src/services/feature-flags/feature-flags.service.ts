import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/database.service'
import { RedisService } from '../redis/redis.service'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

export interface FeatureFlagTarget {
  roles?: string[]
  userIds?: string[]
  minCreatedDaysAgo?: number
  maxCreatedDaysAgo?: number
  customRules?: Record<string, any>
}

export interface FeatureFlag {
  id: string
  name: string
  isEnabled: boolean
  rolloutPercentage: number
  targetAudience: FeatureFlagTarget
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name)
  private readonly CACHE_TTL_SECONDS = 5 * 60
  private readonly HASH_SEED = 'feature-flag-rollout'

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  async isEnabled(
    flagName: string,
    userId: string,
    userRole?: string,
    userCreatedAt?: Date,
  ): Promise<boolean> {
    try {
      const flag = await this.getFlag(flagName)

      if (!flag || !flag.isEnabled) {
        return false
      }

      const matchesAudience = this.matchesAudience(
        flag.targetAudience,
        userId,
        userRole,
        userCreatedAt,
      )

      if (!matchesAudience) {
        return false
      }

      const rolloutPercentage = this.calculateRolloutPercentage(
        userId,
        flagName,
      )

      const isInRollout = rolloutPercentage <= flag.rolloutPercentage

      this.logger.debug(
        `Feature flag '${flagName}': user ${userId} audience ${matchesAudience} rollout ${isInRollout} ${rolloutPercentage}% <= ${flag.rolloutPercentage}%`,
      )

      return isInRollout
    } catch (error) {
      this.logger.error(
        `Error checking feature flag '${flagName}': ${error}`,
      )
      return false
    }
  }

  async isFeatureEnabled(flagName: string): Promise<boolean> {
    const cacheKey = `feature-flag-enabled:${flagName}`
    const nodeEnv =
      this.config.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development'

    try {
      try {
        const cached = await this.redis.get<string>(cacheKey)
        if (cached !== null && cached !== undefined) {
          return cached === '1'
        }
      } catch (_redisErr) {
        this.logger.warn(`Redis unavailable for flag '${flagName}' — skipping cache`)
      }

      try {
        const flag = await this.prisma.featureFlag.findUnique({
          where: { name: flagName },
        })

        if (!flag) {
          if (nodeEnv === 'development') {
            this.logger.warn(
              `Feature flag '${flagName}' not found — allowing in dev`,
            )
            return true
          }
          return false
        }

        const enabled = flag.isEnabled && (flag.rolloutPercentage ?? 100) > 0

        try {
          await this.redis.set(
            cacheKey,
            enabled ? '1' : '0',
            this.CACHE_TTL_SECONDS,
          )
        } catch (_cacheErr) {
        }

        return enabled
      } catch (dbErr) {
        this.logger.error(
          `isFeatureEnabled('${flagName}') DB lookup failed: ${dbErr}`,
        )
        return nodeEnv === 'development'
      }
    } catch (error) {
      this.logger.error(
        `isFeatureEnabled('${flagName}') unexpected failure: ${error}`,
      )
      return nodeEnv === 'development'
    }
  }

  /**
   * Get a single feature flag (cached)
   */
  async getFlag(flagName: string): Promise<FeatureFlag | null> {
    const cacheKey = `feature-flag:${flagName}`;

    // Try cache first
    const cached = await this.redis.get<FeatureFlag>(cacheKey);
    if (cached) {
      this.logger.debug(`Feature flag '${flagName}' from cache`);
      return cached;
    }

    // Get from database
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: flagName },
    });

    if (!flag) {
      return null;
    }

    // Transform JSON to object
    const transformedFlag: FeatureFlag = {
      ...flag,
      targetAudience: flag.targetAudience as any,
    };

    // Cache for 5 minutes
    await this.redis.set<FeatureFlag>(cacheKey, transformedFlag, this.CACHE_TTL_SECONDS);

    this.logger.debug(`Feature flag '${flagName}' from database`);
    return transformedFlag;
  }

  /**
   * Get all feature flags (cached)
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    const cacheKey = 'feature-flags:all';

    // Try cache first
    const cached = await this.redis.get<FeatureFlag[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get from database
    const flags = await this.prisma.featureFlag.findMany();

    const transformed = flags.map((flag: any) => ({
      ...flag,
      targetAudience: flag.targetAudience as any,
    }));

    // Cache for 5 minutes
    await this.redis.set<FeatureFlag[]>(
      cacheKey,
      transformed,
      this.CACHE_TTL_SECONDS,
    );

    return transformed;
  }

  /**
   * Create a new feature flag
   */
  async createFlag(
    name: string,
    isEnabled: boolean,
    rolloutPercentage: number,
    targetAudience: FeatureFlagTarget = {},
  ): Promise<FeatureFlag> {
    const flag = await this.prisma.featureFlag.create({
      data: {
        name,
        isEnabled,
        rolloutPercentage,
        targetAudience: targetAudience as any, // Cast to any for Prisma JSON field
      },
    });

    // Invalidate cache
    await this.invalidateCache();

    this.logger.log(
      `✅ Feature flag '${name}' created. Enabled: ${isEnabled}, Rollout: ${rolloutPercentage}%`,
    );

    const transformed: FeatureFlag = {
      ...flag,
      targetAudience: flag.targetAudience as FeatureFlagTarget,
    };

    return transformed;
  }

  /**
   * Update a feature flag
   */
  async updateFlag(
    flagName: string,
    updates: Partial<{
      isEnabled: boolean;
      rolloutPercentage: number;
      targetAudience: FeatureFlagTarget;
    }>,
  ): Promise<FeatureFlag> {
    // Build data object with proper typing
    const data: any = {};
    
    if (updates.isEnabled !== undefined) data.isEnabled = updates.isEnabled;
    if (updates.rolloutPercentage !== undefined) data.rolloutPercentage = updates.rolloutPercentage;
    if (updates.targetAudience !== undefined) data.targetAudience = updates.targetAudience as any; // Cast for JSON field

    const flag = await this.prisma.featureFlag.update({
      where: { name: flagName },
      data: data,
    });

    // Invalidate cache
    await this.invalidateCache(flagName);

    this.logger.log(
      `✅ Feature flag '${flagName}' updated. New rollout: ${flag.rolloutPercentage}%`,
    );

    const transformed: FeatureFlag = {
      ...flag,
      targetAudience: flag.targetAudience as FeatureFlagTarget,
    };

    return transformed;
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(flagName: string): Promise<void> {
    await this.prisma.featureFlag.delete({
      where: { name: flagName },
    });

    // Invalidate cache
    await this.invalidateCache(flagName);

    this.logger.log(`✅ Feature flag '${flagName}' deleted`);
  }

  /**
   * Invalidate feature flag cache
   */
  private async invalidateCache(flagName?: string): Promise<void> {
    try {
      if (flagName) {
        await this.redis.delete(`feature-flag:${flagName}`);
      } else {
        // Invalidate all flags cache
        await this.redis.delete('feature-flags:all');
      }
      this.logger.debug(`Cache invalidated for feature flags`);
    } catch (error) {
      this.logger.warn(`Failed to invalidate cache: ${error}`);
    }
  }

  /**
   * Check if user matches the audience targeting rules
   */
  private matchesAudience(
    target: FeatureFlagTarget,
    userId: string,
    userRole?: string,
    userCreatedAt?: Date,
  ): boolean {
    // If no targeting rules, everyone is in audience
    if (
      !target ||
      (Object.keys(target).length === 0)
    ) {
      return true;
    }

    // Check role targeting
    if (target.roles && target.roles.length > 0) {
      if (!userRole || !target.roles.includes(userRole)) {
        return false;
      }
    }

    // Check user ID targeting
    if (target.userIds && target.userIds.length > 0) {
      if (!target.userIds.includes(userId)) {
        return false;
      }
    }

    // Check account age targeting (account created less than X days ago)
    if (target.minCreatedDaysAgo !== undefined && userCreatedAt) {
      const createdDaysAgo = Math.floor(
        (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (createdDaysAgo < target.minCreatedDaysAgo) {
        return false;
      }
    }

    // Check max account age
    if (target.maxCreatedDaysAgo !== undefined && userCreatedAt) {
      const createdDaysAgo = Math.floor(
        (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (createdDaysAgo > target.maxCreatedDaysAgo) {
        return false;
      }
    }

    // Passes all targeting rules
    return true;
  }

  /**
   * Calculate rollout percentage using consistent hash
   *
   * Returns 0-100 based on hash of (userId + flagName)
   * Same user always gets same percentage for same flag
   */
  private calculateRolloutPercentage(userId: string, flagName: string): number {
    const hashInput = `${this.HASH_SEED}:${userId}:${flagName}`;
    const hash = crypto
      .createHash('sha256')
      .update(hashInput)
      .digest('hex');

    // Convert first 8 hex chars to number, mod 100 to get 0-99
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const percentage = hashValue % 100;

    return percentage;
  }

  /**
   * Get rollout stats (how many users see each flag)
   */
  async getRolloutStats(flagName: string): Promise<{
    flagName: string;
    enabledPercentage: number;
    estimatedUsersAffected: string;
  }> {
    const flag = await this.getFlag(flagName);

    if (!flag) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    return {
      flagName,
      enabledPercentage: flag.rolloutPercentage,
      estimatedUsersAffected: `${flag.rolloutPercentage}% of audience`,
    };
  }
}
