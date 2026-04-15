'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

interface Suggestion {
  text: string;
  type: 'product' | 'seller';
}

interface AutocompleteResponse {
  products: Suggestion[];
  sellers: Suggestion[];
}

const RECENT_SEARCHES_KEY = 'b2b_recent_searches';
const MAX_RECENT = 5;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === 'undefined' || !query.trim()) return;
  const existing = getRecentSearches().filter((q) => q !== query.trim());
  const updated = [query.trim(), ...existing].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

function clearRecentSearches() {
  if (typeof window !== 'undefined') localStorage.removeItem(RECENT_SEARCHES_KEY);
}

interface SearchBarProps {
  /** Pre-fill value (e.g. current search query from URL) */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional container class names */
  className?: string;
}

export function SearchBar({ defaultValue = '', placeholder = 'Search products, suppliers…', className = '' }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<AutocompleteResponse>({ products: [], sellers: [] });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Flatten all suggestion items for keyboard navigation
  const allItems: Array<{ text: string; label?: string }> = [
    ...recentSearches.map((s) => ({ text: s })),
    ...suggestions.products.map((s) => ({ text: s.text, label: 'Product' })),
    ...suggestions.sellers.map((s) => ({ text: s.text, label: 'Seller' })),
  ];

  const showRecent = query.trim().length === 0;

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions({ products: [], sellers: [] });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/search/autocomplete?q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(2000) },
      );
      if (res.ok) {
        const data: AutocompleteResponse = await res.json();
        setSuggestions(data);
      }
    } catch {
      // Silently ignore — autocomplete is a UX enhancement, not critical
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 300);

    return () => clearTimeout(debounceTimer.current);
  }, [query, fetchSuggestions]);

  // Load recent searches when dropdown opens
  useEffect(() => {
    if (isOpen) setRecentSearches(getRecentSearches());
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigateToSearch = (q: string) => {
    if (!q.trim()) return;
    saveRecentSearch(q.trim());
    setIsOpen(false);
    setActiveIndex(-1);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const displayList = showRecent ? recentSearches : allItems;
    const total = displayList.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < total) {
        e.preventDefault();
        const selected = showRecent ? recentSearches[activeIndex] : allItems[activeIndex].text;
        setQuery(selected);
        navigateToSearch(selected);
      } else {
        // Let form submit handle it
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const hasSuggestions =
    suggestions.products.length > 0 || suggestions.sellers.length > 0;
  const showDropdown = isOpen && (showRecent ? recentSearches.length > 0 : hasSuggestions);

  return (
    <div className={`relative w-full max-w-2xl ${className}`}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative flex items-center">
          <Search
            className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search products and suppliers"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            autoComplete="off"
            className="w-full rounded-full border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                setSuggestions({ products: [], sellers: [] });
                inputRef.current?.focus();
              }}
              className="absolute right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full z-50 mt-1.5 w-full rounded-lg border border-border bg-card shadow-lg"
        >
          {/* Recent searches */}
          {showRecent && recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((item, i) => (
                <SuggestionRow
                  key={`recent-${i}`}
                  text={item}
                  icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />}
                  isActive={activeIndex === i}
                  onSelect={() => {
                    setQuery(item);
                    navigateToSearch(item);
                  }}
                />
              ))}
            </div>
          )}

          {/* Product suggestions */}
          {!showRecent && suggestions.products.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Products
              </p>
              {suggestions.products.map((s, i) => (
                <SuggestionRow
                  key={`product-${i}`}
                  text={s.text}
                  icon={<Search className="h-3.5 w-3.5 text-muted-foreground" />}
                  isActive={activeIndex === i}
                  onSelect={() => {
                    setQuery(s.text);
                    navigateToSearch(s.text);
                  }}
                />
              ))}
            </div>
          )}

          {/* Seller suggestions */}
          {!showRecent && suggestions.sellers.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sellers
              </p>
              {suggestions.sellers.map((s, i) => {
                const idx = suggestions.products.length + i;
                return (
                  <SuggestionRow
                    key={`seller-${i}`}
                    text={s.text}
                    icon={<TrendingUp className="h-3.5 w-3.5 text-blue-500" />}
                    label="Seller"
                    isActive={activeIndex === idx}
                    onSelect={() => {
                      setQuery(s.text);
                      navigateToSearch(s.text);
                    }}
                  />
                );
              })}
            </div>
          )}

          {isLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  text,
  icon,
  label,
  isActive,
  onSelect,
}: {
  text: string;
  icon: React.ReactNode;
  label?: string;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        isActive ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted/50'
      }`}
    >
      {icon}
      <span className="flex-1 truncate">{text}</span>
      {label && (
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      )}
    </button>
  );
}

export default SearchBar;
