'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const LOCALES = [
  { code: 'en', label: 'EN', nativeLabel: 'English' },
  { code: 'hi', label: 'हि', nativeLabel: 'हिंदी' },
] as const;

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('common');

  function switchLocale(next: string) {
    if (next === locale) return;
    // Set a non-HttpOnly cookie readable by next-intl server config
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5"
      title={t('language')}
      aria-label="Switch language"
    >
      {LOCALES.map(({ code, label, nativeLabel }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={isPending}
          title={nativeLabel}
          aria-pressed={locale === code}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
            locale === code
              ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          } ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
