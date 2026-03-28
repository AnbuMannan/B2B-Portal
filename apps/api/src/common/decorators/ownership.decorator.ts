import { SetMetadata } from '@nestjs/common';

export interface OwnershipOptions {
  entityType: 'product' | 'seller' | 'order' | 'lead';
  paramName: string;
}

/**
 * Marks an endpoint to verify user owns the resource.
 * Use with OwnershipGuard.
 * 
 * Example:
 * @Patch('products/:productId')
 * @Ownership({ entityType: 'product', paramName: 'productId' })
 * async updateProduct(@Param('productId') id: string) { }
 */
export const Ownership = (options: OwnershipOptions) =>
  SetMetadata('ownership', options);
