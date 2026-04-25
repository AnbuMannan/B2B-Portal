/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { usePathname } from 'next/navigation';
import BuyerShell from '../../components/buyer/BuyerShell';

const INTERNAL_ROUTES = [
  '/buyer/dashboard',
  '/buyer/requirements',
  '/buyer/quotes',
  '/buyer/orders',
  '/buyer/saved-sellers',
  '/buyer/saved',
  '/buyer/browse',
  '/buyer/profile',
  '/buyer/complaints',
  '/buyer/settings',
];

export default function BuyerLayout({ children }: any) {
  const pathname = usePathname();

  const isInternal = INTERNAL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/'),
  );
  // Registration page uses its own full-bleed layout
  const isRegister = pathname === '/buyer/register';

  if (isRegister || !isInternal) {
    return <>{children}</>;
  }

  return <BuyerShell>{children}</BuyerShell>;
}
