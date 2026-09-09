"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchWallpapers, getFavorites, type WallpaperItem, type FavoriteRow } from "@/lib/gallery";
import WallpaperViewer from "./WallpaperViewer";

export default function GalleryView() {
  const [tab, setTab] = useState<"browse" | "favorites">("browse");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WallpaperItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const [viewing, setViewing] = useState<WallpaperItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadFavorites = useCallback(async () => {
    try {
      const rows = await getFavorites();
      setFavorites(rows);
      setFavoriteIds(new Set(rows.map((r) => r.wallhaven_id)));
    } catch {
      // Favorites are non-critical — fail quietly, the browse tab still works.
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const runSearch = useCallback(async (q: string, pageNum: number) => {
    setError(null);
    try {
      const result = await searchWallpapers(q, pageNum);
      setItems((prev) => (pageNum === 1 ? result.data : [...prev, ...result.data]));
      setHasMore(result.meta.current_page < result.meta.last_page);
      setPage(pageNum);
    } catch {
      setError("Couldn't load the gallery right now.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    runSearch(query, 1).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    runSearch(query, 1).finally(() => setLoading(false));
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || tab !== "browse") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true);
          runSearch(query, page + 1).finally(() => setLoadingMore(false));
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, loadingMore, page, query, runSearch, tab]);

  function handleFavoriteChange(wallpaper: WallpaperItem, fav: boolean) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (fav) next.add(wallpaper.id);
      else next.delete(wallpaper.id);
      return next;
    });
    if (!fav) setFavorites((prev) => prev.filter((f) => f.wallhaven_id !== wallpaper.id));
    else loadFavorites();
  }

  const displayed: { id: string; thumb: string; path: string; resolution: string }[] =
    tab === "browse"
      ? items.map((w) => ({ id: w.id, thumb: w.thumbs.large, path: w.path, resolution: w.resolution }))
      : favorites.map((f) => ({ id: f.wallhaven_id, thumb: f.thumb_url, path: f.full_url, resolution: f.resolution ?? "" }));

  return (
    <div className="px-3 py-3">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search wallpapers…"
          className="flex-1 rounded-full bg-black/5 px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-from dark:bg-white/10"
        />
        <button type="submit" className="rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setTab("browse")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "browse" ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"}`}
        >
          Browse
        </button>
        <button
          onClick={() => setTab("favorites")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === "favorites" ? "bg-brand-gradient text-white" : "bg-black/5 dark:bg-white/10"}`}
        >
          Favorites ({favorites.length})
        </button>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}

      {loading ? (
        <p className="mt-8 text-center text-sm text-ink-muted">Loading…</p>
      ) : displayed.length === 0 ? (
        <p className="mt-8 text-center text-sm text-ink-muted">
          {tab === "favorites" ? "No favorites yet — tap the heart on any wallpaper." : "No results."}
        </p>
      ) : (
        <div className="mt-3 columns-2 gap-2">
          {displayed.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                const full = tab === "browse" ? items.find((w) => w.id === d.id) : null;
                if (full) setViewing(full);
                else {
                  // Favorites tab: reconstruct enough of a WallpaperItem to view/act on.
                  setViewing({
                    id: d.id,
                    path: d.path,
                    thumbs: { small: d.thumb, large: d.thumb, original: d.thumb },
                    resolution: d.resolution,
                    file_size: 0,
                  });
                }
              }}
              className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl2 bg-black/5 dark:bg-white/10"
            >
              <img src={d.thumb} alt="" className="w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {tab === "browse" && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && <p className="py-4 text-center text-xs text-ink-muted">Loading more…</p>}

      {viewing && (
        <WallpaperViewer
          wallpaper={viewing}
          isFavorite={favoriteIds.has(viewing.id)}
          onFavoriteChange={(fav) => handleFavoriteChange(viewing, fav)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
