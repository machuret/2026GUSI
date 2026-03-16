"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { authFetch } from "@/lib/authFetch";
import { Video, VideoCategory, Pagination } from "../types";
import { VIDEOS_PER_PAGE } from "../helpers";

export function useVideoFetch() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Server-side filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const buildUrl = useCallback((page: number) => {
    const params = new URLSearchParams({ page: String(page), limit: String(VIDEOS_PER_PAGE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterCat && filterCat !== "all") params.set("categoryId", filterCat);
    return `/api/videos?${params}`;
  }, [debouncedSearch, filterCat]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await authFetch("/api/videos/categories");
      const data = await res.json();
      setCategories(data.categories ?? []);
    } catch (err) { console.error("Categories fetch:", err); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(buildUrl(1));
      const data = await res.json();
      setVideos(data.videos ?? []);
      setPagination(data.pagination ?? null);
    } catch { setError("Failed to load data"); }
    finally { setLoading(false); }
  }, [buildUrl]);

  const loadMore = async () => {
    if (!pagination?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await authFetch(buildUrl(pagination.page + 1));
      const data = await res.json();
      setVideos((prev) => [...prev, ...(data.videos ?? [])]);
      setPagination(data.pagination ?? null);
    } catch { setError("Failed to load more"); }
    finally { setLoadingMore(false); }
  };

  // Fetch categories once on mount
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  // Fetch videos whenever search/filter changes
  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    videos, setVideos, pagination, categories, setCategories,
    loading, loadingMore, error, setError,
    search, setSearch, debouncedSearch, filterCat, setFilterCat,
    fetchData, fetchCategories, loadMore,
  };
}
