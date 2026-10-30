import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Building2, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface PropertySelectorItem {
  id: string;
  title: string;
  location: string;
  price?: number;
  transactionType?: string;
  images?: string[];
  geoLocatedImage?: string;
  statusText?: string;
  statusVariant?: 'occupied' | 'vacant' | 'listed' | 'private' | 'active' | 'pending' | 'warning' | 'default' | 'self_managed';
  isListed?: boolean;
  occupancyStatus?: string;
  saleStatus?: string;
  badgeCount?: number;
  raw: any;
}

interface PropertyHorizontalSelectorProps {
  items: PropertySelectorItem[];
  selectedId: string | null;
  onSelect: (item: PropertySelectorItem) => void;
  emptyMessage?: string;
}

export default function PropertyHorizontalSelector({
  items,
  selectedId,
  onSelect,
  emptyMessage = 'No properties available',
}: PropertyHorizontalSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [items]);

  // Scroll active item into view smoothly on mount or selection change
  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector<HTMLElement>(`[data-item-id="${selectedId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [selectedId]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const distance = 280;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground border rounded-xl bg-card/40">
        {emptyMessage}
      </div>
    );
  }

  const renderBadge = (item: PropertySelectorItem) => {
    const text = item.statusText;
    if (!text) return null;

    let badgeClass = 'bg-muted text-muted-foreground border-border/40';
    if (item.statusVariant === 'occupied') {
      badgeClass = 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    } else if (item.statusVariant === 'vacant') {
      badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    } else if (item.statusVariant === 'listed') {
      badgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    } else if (item.statusVariant === 'private') {
      badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    } else if (item.statusVariant === 'active') {
      badgeClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    } else if (item.statusVariant === 'pending') {
      badgeClass = 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    } else if (item.statusVariant === 'warning') {
      badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700';
    } else if (item.statusVariant === 'self_managed') {
      badgeClass = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-700';
    }

    return (
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${badgeClass} shrink-0 truncate max-w-[85px]`}>
        {text}
      </span>
    );
  };

  return (
    <div className="relative group w-full">
      {/* Left Scroll Button */}
      {canScrollLeft && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Scroll left"
          onClick={() => scroll('left')}
          className="absolute -left-2 sm:-left-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full shadow-md bg-background/90 backdrop-blur-xs border-border/80 hover:bg-background hidden sm:flex items-center justify-center"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Horizontal Strip */}
      <div
        ref={scrollRef}
        role="region"
        aria-label="Property selector"
        className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scroll-smooth no-scrollbar w-full flex-nowrap"
      >
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const thumbnail =
            item.images && item.images.length > 0
              ? item.images[0]
              : item.geoLocatedImage || null;

          return (
            <div
              key={item.id}
              data-item-id={item.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Select ${item.title}`}
              onClick={() => onSelect(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(item);
                }
              }}
              className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all duration-200 cursor-pointer select-none text-left shrink-0 w-56 sm:w-60 min-w-[200px] max-w-[250px] ${
                isSelected
                  ? 'border-2 border-blue-500 dark:border-sky-400 bg-blue-50/40 dark:bg-gradient-to-b dark:from-[#0e1d35]/95 dark:to-[#07111e]/95 dark:backdrop-blur-xl shadow-xs dark:shadow-xl dark:shadow-black/40 ring-1 ring-blue-500/20'
                  : 'border border-slate-200/90 dark:border-sky-500/20 bg-white dark:bg-[#0a1628]/85 dark:backdrop-blur-xl hover:bg-slate-50/80 dark:hover:bg-[#0f213d]/90 shadow-2xs dark:shadow-xl dark:shadow-black/40'
              }`}
            >
              {/* Thumbnail */}
              <div className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-lg overflow-hidden bg-muted/60 dark:bg-[#07111e] shrink-0 border border-border/50 dark:border-sky-500/20">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full w-full text-muted-foreground/40">
                    <Building2 className="h-5 w-5" />
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-primary ring-1 ring-background" />
                )}
                {item.badgeCount != null && item.badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
                    {item.badgeCount}
                  </span>
                )}
              </div>

              {/* Info Column */}
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
                <div className="flex items-center justify-between gap-1">
                  <h4
                    className={`text-xs sm:text-sm font-semibold truncate leading-tight ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </h4>
                </div>

                <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 text-primary shrink-0" />
                  <span className="truncate">{item.location}</span>
                </p>

                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span className="text-[11px] font-bold text-foreground truncate">
                    {item.price != null
                      ? `₹${Number(item.price).toLocaleString('en-IN')}${
                          item.transactionType?.toLowerCase() === 'rent' ? '/mo' : ''
                        }`
                      : '-'}
                  </span>
                  {renderBadge(item)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right Scroll Button */}
      {canScrollRight && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Scroll right"
          onClick={() => scroll('right')}
          className="absolute -right-2 sm:-right-3 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full shadow-md bg-background/90 backdrop-blur-xs border-border/80 hover:bg-background hidden sm:flex items-center justify-center"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
