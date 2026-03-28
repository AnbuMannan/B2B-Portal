import { SetMetadata } from '@nestjs/common';

/**
 * Marks an endpoint with required user roles.
 * Use with RoleBasedGuard to restrict access.
 * 
 * Example:
 * @Post('products')
 * @Roles('SELLER', 'ADMIN')
 * async createProduct(@Body() dto: CreateProductDto) { }
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
