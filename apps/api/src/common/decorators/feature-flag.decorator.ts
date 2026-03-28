import { SetMetadata } from '@nestjs/common'

export const FEATURE_FLAG_METADATA = 'feature_flag'

export interface FeatureFlagOptions {
  name: string
  fallback?: any
}

export const FeatureFlag = (options: FeatureFlagOptions) => {
  return SetMetadata(FEATURE_FLAG_METADATA, options)
}
