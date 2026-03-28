import { SetMetadata } from '@nestjs/common';

export interface AuditableOptions {
  entity: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
}

/**
 * Marks an endpoint to be automatically audited
 *
 * Usage:
 * @Post('products')
 * @Auditable({ entity: 'PRODUCT', action: 'CREATE' })
 * async createProduct(@Body() dto: CreateProductDto) { }
 *
 * @Patch('products/:id')
 * @Auditable({ entity: 'PRODUCT', action: 'UPDATE' })
 * async updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) { }
 */
export const Auditable = (options: AuditableOptions) =>
  SetMetadata('auditable', options);
