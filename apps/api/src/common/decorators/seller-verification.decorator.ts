import { SetMetadata } from '@nestjs/common'

export const REQUIRE_SELLER_VERIFICATION_KEY = 'requireSellerVerification'

export const RequireSellerVerification = () =>
  SetMetadata(REQUIRE_SELLER_VERIFICATION_KEY, true)

