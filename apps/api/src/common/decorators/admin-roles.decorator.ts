import { SetMetadata } from '@nestjs/common';

export type AdminRoleType = 'SUPER_ADMIN' | 'ADMIN' | 'REVIEWER' | 'FINANCE' | 'SUPPORT';

export const ADMIN_ROLES_KEY = 'adminRoles';

/**
 * Restricts an endpoint to specific admin sub-roles.
 * Must be used with @UseGuards(AdminRolesGuard).
 *
 * Role permissions:
 *   SUPER_ADMIN — all permissions
 *   ADMIN       — KYC approval, product approval, user management
 *   REVIEWER    — product listing review only
 *   FINANCE     — financial dashboard, refunds
 *   SUPPORT     — complaint tickets
 */
export const AdminRoles = (...roles: AdminRoleType[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
