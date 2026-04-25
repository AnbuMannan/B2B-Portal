'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'KYC Approvals',
    href: '/admin/kyc',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Product Approvals',
    href: '/admin/products',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN', 'REVIEWER'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Complaints',
    href: '/admin/complaints',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  },
  {
    label: 'Finance',
    href: '/admin/finance',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'FINANCE'],
  },
  {
    label: 'Fraud Management',
    href: '/admin/fraud',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Content & Config',
    href: '/admin/content',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    roles: ['SUPER_ADMIN'],
  },
  {
    label: 'Admin Users',
    href: '/admin/admins',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    roles: ['SUPER_ADMIN'],
  },
];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-red-500/20 text-red-300' },
  ADMIN:       { label: 'Admin',       color: 'bg-blue-500/20 text-blue-300' },
  REVIEWER:    { label: 'Reviewer',    color: 'bg-yellow-500/20 text-yellow-300' },
  FINANCE:     { label: 'Finance',     color: 'bg-green-500/20 text-green-300' },
  SUPPORT:     { label: 'Support',     color: 'bg-purple-500/20 text-purple-300' },
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminRole, setAdminRole] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminAccessToken');
    const expiry = localStorage.getItem('adminSessionExpiry');
    if (!token || !expiry || Date.now() > Number(expiry)) {
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminRole');
      localStorage.removeItem('adminEmail');
      localStorage.removeItem('adminSessionExpiry');
      router.push('/admin/login');
      return;
    }
    setAdminRole(localStorage.getItem('adminRole') ?? '');
    setAdminEmail(localStorage.getItem('adminEmail') ?? '');
    const saved = localStorage.getItem('adminTheme');
    if (saved === 'light') setDark(false);
  }, [router]);

  const toggleTheme = () => {
    setDark(d => {
      localStorage.setItem('adminTheme', d ? 'light' : 'dark');
      return !d;
    });
  };

  // theme-aware class helpers
  const t = {
    shell:       dark ? 'bg-slate-950'                       : 'bg-gray-100',
    sidebar:     dark ? 'bg-slate-900 border-slate-800'      : 'bg-white border-gray-200',
    logo:        dark ? 'border-slate-800'                   : 'border-gray-200',
    logoText:    dark ? 'text-white'                         : 'text-gray-900',
    toggleBtn:   dark ? 'text-slate-500 hover:text-slate-300': 'text-gray-400 hover:text-gray-600',
    navActive:   dark ? 'bg-blue-600/20 text-blue-400'       : 'bg-blue-50 text-blue-600',
    navInactive: dark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
    userBorder:  dark ? 'border-slate-800'                   : 'border-gray-200',
    avatar:      dark ? 'bg-slate-700 text-slate-300'        : 'bg-gray-200 text-gray-600',
    userEmail:   dark ? 'text-white'                         : 'text-gray-900',
    signout:     dark ? 'text-slate-500 hover:text-red-400'  : 'text-gray-400 hover:text-red-500',
    main:        dark ? 'bg-slate-950'                       : 'bg-gray-50',
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminSessionExpiry');
    router.push('/admin/login');
  };

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(adminRole),
  );

  const badge = ROLE_BADGE[adminRole];

  return (
    <div className={`min-h-screen flex transition-colors duration-200 ${t.shell}${dark ? ' dark' : ''}`}>
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} flex-shrink-0 border-r flex flex-col transition-all duration-200 ${t.sidebar}`}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${t.logo}`}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          {sidebarOpen && (
            <span className={`font-semibold text-sm truncate ${t.logoText}`}>B2B Admin</span>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`ml-auto ${t.toggleBtn}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={sidebarOpen ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'} />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${active ? t.navActive : t.navInactive}`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User + theme toggle */}
        <div className={`border-t p-3 space-y-2 ${t.userBorder}`}>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-2 text-xs transition-colors w-full ${sidebarOpen ? '' : 'justify-center'} ${t.toggleBtn}`}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            {sidebarOpen && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${t.avatar}`}>
                {adminEmail?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="min-w-0">
                <p className={`text-xs truncate ${t.userEmail}`}>{adminEmail}</p>
                {badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 text-xs transition-colors w-full ${sidebarOpen ? '' : 'justify-center'} ${t.signout}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col min-w-0 transition-colors duration-200 ${t.main}`}>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
