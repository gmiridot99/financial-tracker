'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  X,
  Search,
  TrendingUp,
  Building2,
  Coins,
  BarChart3,
  Landmark,
  Gem,
  LayoutGrid,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssetSearchResult {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'crypto' | 'bond' | 'commodity' | 'index';
  exchange?: string;
  currency?: string;
  coingecko_id?: string;
  thumb?: string;
}

interface AssetSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: AssetSearchResult) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type CategoryKey = 'all' | 'stock' | 'etf' | 'index' | 'crypto' | 'bond' | 'commodity';

interface CategoryTab {
  key: CategoryKey;
  label: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryTab[] = [
  { key: 'all', label: 'Tutto', icon: LayoutGrid },
  { key: 'stock', label: 'Azioni', icon: Building2 },
  { key: 'etf', label: 'ETF', icon: BarChart3 },
  { key: 'index', label: 'Indici', icon: TrendingUp },
  { key: 'crypto', label: 'Crypto', icon: Coins },
  { key: 'bond', label: 'Obbligazioni', icon: Landmark },
  { key: 'commodity', label: 'Commodities', icon: Gem },
];

const TYPE_BADGE_STYLES: Record<string, string> = {
  stock: 'bg-blue-500/20 text-blue-300',
  etf: 'bg-emerald-500/20 text-emerald-300',
  crypto: 'bg-orange-500/20 text-orange-300',
  index: 'bg-purple-500/20 text-purple-300',
  bond: 'bg-gray-500/20 text-gray-300',
  commodity: 'bg-amber-500/20 text-amber-300',
  manual: 'bg-warmText-tertiary/20 text-warmText-secondary',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Stock',
  etf: 'ETF',
  crypto: 'Crypto',
  index: 'Index',
  bond: 'Bond',
  commodity: 'Commodity',
  manual: 'Manuale',
};

interface PopularAsset {
  symbol: string;
  name: string;
  type: AssetSearchResult['type'];
  exchange?: string;
  coingecko_id?: string;
}

const POPULAR_ASSETS: PopularAsset[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla', type: 'stock', exchange: 'NASDAQ' },
  { symbol: 'VWCE.MI', name: 'Vanguard FTSE All-World', type: 'etf', exchange: 'Milan' },
  { symbol: 'SWDA.MI', name: 'iShares Core MSCI World', type: 'etf', exchange: 'Milan' },
  { symbol: 'EIMI.MI', name: 'iShares Core EM IMI', type: 'etf', exchange: 'Milan' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', coingecko_id: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto', coingecko_id: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto', coingecko_id: 'solana' },
];

// Category ordering for grouped display in "Tutto" mode
const CATEGORY_DISPLAY_ORDER: CategoryKey[] = [
  'stock',
  'etf',
  'index',
  'crypto',
  'bond',
  'commodity',
];

const CATEGORY_SECTION_LABELS: Record<string, string> = {
  stock: 'Azioni',
  etf: 'ETF',
  index: 'Indici',
  crypto: 'Crypto',
  bond: 'Obbligazioni',
  commodity: 'Commodities',
};

// ---------------------------------------------------------------------------
// Skeleton Components
// ---------------------------------------------------------------------------

function ResultSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-warmBg-tertiary/50">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 flex items-center gap-3"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Type badge skeleton */}
          <div className="w-12 h-5 rounded-full bg-warmBg-tertiary animate-pulse" />
          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-16 h-4 rounded bg-warmBg-tertiary animate-pulse" />
              <div className="w-20 h-3 rounded bg-warmBg-tertiary/60 animate-pulse" />
            </div>
            <div className="w-36 h-3 rounded bg-warmBg-tertiary/40 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Row Component
// ---------------------------------------------------------------------------

interface ResultRowProps {
  asset: AssetSearchResult;
  isHighlighted: boolean;
  index: number;
  onSelect: () => void;
  onMouseEnter: () => void;
}

function ResultRow({ asset, isHighlighted, index, onSelect, onMouseEnter }: ResultRowProps) {
  const badgeStyle = TYPE_BADGE_STYLES[asset.type] || TYPE_BADGE_STYLES.stock;
  const label = TYPE_LABELS[asset.type] || asset.type;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={`
        w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
        ${isHighlighted ? 'bg-warmBg-hover' : 'hover:bg-warmBg-hover'}
        animate-slideInUp
      `}
      style={{
        animationDelay: `${Math.min(index * 30, 300)}ms`,
        animationFillMode: 'backwards',
      }}
      role="option"
      aria-selected={isHighlighted}
    >
      {/* Crypto thumbnail */}
      {asset.thumb && (
        <img
          src={asset.thumb}
          alt=""
          className="w-6 h-6 rounded-full flex-shrink-0"
          loading="lazy"
        />
      )}

      {/* Symbol + Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-warmText-primary tracking-wide">
            {asset.symbol}
          </span>
          {asset.exchange && (
            <span className="text-xs leading-tight text-warmText-muted font-medium">
              {asset.exchange}
            </span>
          )}
        </div>
        <p className="text-xs text-warmText-secondary truncate leading-relaxed">
          {asset.name}
        </p>
      </div>

      {/* Type badge */}
      <span
        className={`
          px-2.5 py-0.5 rounded-full text-xs leading-tight font-semibold uppercase tracking-wider flex-shrink-0
          ${badgeStyle}
        `}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Popular Assets Section
// ---------------------------------------------------------------------------

interface PopularSectionProps {
  activeCategory: CategoryKey;
  onSelect: (asset: AssetSearchResult) => void;
}

function PopularSection({ activeCategory, onSelect }: PopularSectionProps) {
  const filtered = useMemo(() => {
    if (activeCategory === 'all') return POPULAR_ASSETS;
    return POPULAR_ASSETS.filter((a) => a.type === activeCategory);
  }, [activeCategory]);

  // Group by type for display (must be before any early return to respect hooks rules)
  const grouped = useMemo(() => {
    const map = new Map<string, PopularAsset[]>();
    for (const asset of filtered) {
      const group = map.get(asset.type) || [];
      group.push(asset);
      map.set(asset.type, group);
    }
    return map;
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-warmText-tertiary text-sm">
          Inizia a digitare per cercare
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-5">
      <p className="text-xs font-semibold text-warmText-tertiary uppercase tracking-wider">
        Popolari
      </p>
      {Array.from(grouped.entries()).map(([type, assets]) => (
        <div key={type} className="space-y-2.5">
          {activeCategory === 'all' && (
            <p className="text-xs leading-tight font-medium text-warmText-muted uppercase tracking-wider">
              {CATEGORY_SECTION_LABELS[type] || type}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {assets.map((asset) => (
              <button
                key={`${asset.symbol}-${asset.type}`}
                onClick={() =>
                  onSelect({
                    symbol: asset.symbol,
                    name: asset.name,
                    type: asset.type,
                    exchange: asset.exchange,
                    coingecko_id: asset.coingecko_id,
                  })
                }
                className="
                  group flex items-center gap-1.5
                  px-3 py-1.5 rounded-full
                  bg-warmBg-tertiary/70 text-warmText-primary
                  hover:bg-warmAccent-primary/20 hover:text-warmAccent-primary
                  active:scale-95
                  transition-all duration-150
                  text-xs font-medium
                "
              >
                <span className="font-bold">{asset.symbol}</span>
                <span className="text-warmText-tertiary group-hover:text-warmAccent-primary/70 text-xs leading-tight hidden sm:inline">
                  {asset.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AssetSearchModal({
  isOpen,
  onClose,
  onSelect,
}: AssetSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pillsRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Search Logic
  // -----------------------------------------------------------------------

  const performSearch = useCallback(
    async (searchQuery: string, category: CategoryKey) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasSearched(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);
      setError(null);
      setHighlightedIndex(-1);

      try {
        const encoded = encodeURIComponent(searchQuery.trim());
        const shouldSearchYahoo = category !== 'crypto';
        const shouldSearchCrypto = category === 'all' || category === 'crypto';

        const typeParam = category !== 'all' && category !== 'crypto'
          ? `&type=${category}`
          : '';

        const promises: Promise<AssetSearchResult[]>[] = [];

        const { data: { session } } = await supabase.auth.getSession();
        const authHeader: HeadersInit = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};

        if (shouldSearchYahoo) {
          promises.push(
            fetch(`/api/assets/search?q=${encoded}${typeParam}`, { headers: authHeader })
              .then((r) => (r.ok ? r.json() : []))
              .then((data) => (Array.isArray(data) ? data : []))
              .catch(() => [] as AssetSearchResult[])
          );
        }

        if (shouldSearchCrypto) {
          promises.push(
            fetch(`/api/assets/search-crypto?q=${encoded}`, { headers: authHeader })
              .then((r) => (r.ok ? r.json() : []))
              .then((data) => (Array.isArray(data) ? data : []))
              .catch(() => [] as AssetSearchResult[])
          );
        }

        const responses = await Promise.all(promises);
        const combined = responses.flat();

        setResults(combined.slice(0, 25));
      } catch (err) {
        console.error('Search error:', err);
        setError('Qualcosa non va. Riprova tra poco.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // -----------------------------------------------------------------------
  // Debounced search trigger
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query, activeCategory);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeCategory, performSearch]);

  // -----------------------------------------------------------------------
  // Reset on open/close
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setActiveCategory('all');
      setHighlightedIndex(-1);
      setError(null);
      return;
    }
    // Auto-focus input when modal opens
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // -----------------------------------------------------------------------
  // Group results for "Tutto" mode
  // -----------------------------------------------------------------------

  const groupedResults = useMemo(() => {
    if (activeCategory !== 'all') return null;

    const map = new Map<string, AssetSearchResult[]>();
    for (const result of results) {
      const group = map.get(result.type) || [];
      group.push(result);
      map.set(result.type, group);
    }
    return map;
  }, [results, activeCategory]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    if (activeCategory !== 'all') return results;
    // Maintain category order for the flat list
    const flat: AssetSearchResult[] = [];
    for (const cat of CATEGORY_DISPLAY_ORDER) {
      const group = groupedResults?.get(cat);
      if (group) flat.push(...group);
    }
    return flat;
  }, [results, activeCategory, groupedResults]);

  // -----------------------------------------------------------------------
  // Keyboard Navigation
  // -----------------------------------------------------------------------

  const handleSelect = useCallback(
    (asset: AssetSearchResult) => {
      onSelect(asset);
      onClose();
    },
    [onSelect, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < flatResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : flatResults.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < flatResults.length) {
            handleSelect(flatResults[highlightedIndex]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, highlightedIndex, handleSelect, onClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll('[role="option"]');
    items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  // -----------------------------------------------------------------------
  // Click outside to close
  // -----------------------------------------------------------------------

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderGroupedResults = () => {
    if (!groupedResults) return null;

    let globalIndex = 0;
    const sections: React.ReactNode[] = [];

    for (const cat of CATEGORY_DISPLAY_ORDER) {
      const group = groupedResults.get(cat);
      if (!group || group.length === 0) continue;

      const startIndex = globalIndex;

      sections.push(
        <div key={cat}>
          <div className="px-4 pt-4 pb-1.5">
            <p className="text-xs leading-tight font-semibold text-warmText-tertiary uppercase tracking-wider">
              {CATEGORY_SECTION_LABELS[cat]}
            </p>
          </div>
          {group.map((asset, i) => {
            const idx = startIndex + i;
            globalIndex++;
            return (
              <ResultRow
                key={`${asset.symbol}-${asset.type}-${idx}`}
                asset={asset}
                isHighlighted={highlightedIndex === idx}
                index={i}
                onSelect={() => handleSelect(asset)}
                onMouseEnter={() => setHighlightedIndex(idx)}
              />
            );
          })}
        </div>
      );

      // Update globalIndex after the loop since we increment inside
      globalIndex = startIndex + group.length;
    }

    return <>{sections}</>;
  };

  const renderFlatResults = () => (
    <div className="divide-y divide-warmBg-tertiary/30">
      {results.map((asset, i) => (
        <ResultRow
          key={`${asset.symbol}-${asset.type}-${i}`}
          asset={asset}
          isHighlighted={highlightedIndex === i}
          index={i}
          onSelect={() => handleSelect(asset)}
          onMouseEnter={() => setHighlightedIndex(i)}
        />
      ))}
    </div>
  );

  // -----------------------------------------------------------------------
  // Gate: don't render if closed
  // -----------------------------------------------------------------------

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Cerca asset"
    >
      <div
        ref={modalRef}
        className="
          w-full h-full
          sm:h-auto sm:max-h-[85vh] sm:max-w-2xl
          bg-warmBg-primary sm:rounded-2xl sm:shadow-2xl
          flex flex-col overflow-hidden
          animate-cardEnter
        "
      >
        {/* ---------------------------------------------------------------
            Sticky Header: Search Input + Category Pills
        --------------------------------------------------------------- */}
        <div className="flex-shrink-0 border-b border-warmBg-tertiary/60">
          {/* Search bar */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="w-5 h-5 text-warmText-tertiary flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca azioni, ETF, crypto, indici..."
              className="
                flex-1 bg-transparent text-warmText-primary
                placeholder-warmText-muted text-sm
                focus:outline-none
              "
              aria-label="Cerca asset"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="
                  w-6 h-6 flex items-center justify-center
                  text-warmText-tertiary hover:text-warmText-primary
                  rounded-full hover:bg-warmBg-tertiary
                  transition-colors
                "
                aria-label="Cancella ricerca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="
                w-8 h-8 flex items-center justify-center
                text-warmText-tertiary hover:text-warmText-primary
                hover:bg-warmBg-tertiary rounded-full
                transition-colors active:scale-95
              "
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category pills */}
          <div
            ref={pillsRef}
            className="
              flex gap-1.5 px-4 pb-3
              overflow-x-auto scrollbar-hide
            "
            role="tablist"
            aria-label="Filtra per categoria"
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setHighlightedIndex(-1);
                  }}
                  className={`
                    flex items-center gap-1.5
                    px-3 py-1.5 rounded-full text-xs font-medium
                    whitespace-nowrap flex-shrink-0
                    transition-all duration-150 active:scale-95
                    ${
                      isActive
                        ? 'bg-warmAccent-primary text-white shadow-md shadow-warmAccent-primary/25'
                        : 'bg-warmBg-tertiary text-warmText-secondary hover:bg-warmBg-hover'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------------
            Results Area
        --------------------------------------------------------------- */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          role="listbox"
          aria-label="Risultati ricerca"
        >
          {/* Loading skeleton */}
          {isLoading && <ResultSkeleton count={6} />}

          {/* Error state */}
          {!isLoading && error && (
            <div className="px-4 py-12 text-center space-y-2">
              <p className="text-warmText-secondary text-sm">{error}</p>
              <button
                onClick={() => performSearch(query, activeCategory)}
                className="
                  text-warmAccent-primary text-xs font-medium
                  hover:underline
                "
              >
                Riprova
              </button>
            </div>
          )}

          {/* No results */}
          {!isLoading && !error && hasSearched && results.length === 0 && (
            <div className="px-4 py-12 text-center space-y-1">
              <p className="text-warmText-secondary text-sm">
                Nessun risultato per &ldquo;{query}&rdquo;
              </p>
              <p className="text-warmText-muted text-xs">
                Prova con un altro termine o cambia categoria
              </p>
            </div>
          )}

          {/* Results: grouped or flat */}
          {!isLoading && !error && results.length > 0 && (
            <>
              {activeCategory === 'all'
                ? renderGroupedResults()
                : renderFlatResults()}
            </>
          )}

          {/* Popular assets (when no search query) */}
          {!isLoading && !error && !hasSearched && (
            <PopularSection
              activeCategory={activeCategory}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* ---------------------------------------------------------------
            Footer hint
        --------------------------------------------------------------- */}
        <div className="flex-shrink-0 px-4 py-2 border-t border-warmBg-tertiary/40">
          <div className="flex items-center justify-between text-xs leading-tight text-warmText-muted">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="px-1 py-0.5 rounded bg-warmBg-tertiary text-warmText-tertiary font-mono text-[9px]">
                  ↑↓
                </kbd>{' '}
                naviga
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-warmBg-tertiary text-warmText-tertiary font-mono text-[9px]">
                  ↵
                </kbd>{' '}
                seleziona
              </span>
              <span>
                <kbd className="px-1 py-0.5 rounded bg-warmBg-tertiary text-warmText-tertiary font-mono text-[9px]">
                  esc
                </kbd>{' '}
                chiudi
              </span>
            </div>
            {hasSearched && results.length > 0 && (
              <span>{results.length} risultat{results.length === 1 ? 'o' : 'i'}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
