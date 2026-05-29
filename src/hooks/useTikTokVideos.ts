/**
 * Loads the connected user's OWN TikTok videos via the backend Display API
 * (`GET /v1/tiktok/videos`, scope `video.list`). Handles pagination (cursor)
 * and exposes typed, user-facing states so the screen stays presentational.
 *
 * Scope reality: this only returns the authenticated user's videos. TikTok does
 * not allow searching arbitrary public videos with a Login Kit app — that needs
 * the Research API (restricted to vetted institutions). The hook therefore never
 * pretends to "search TikTok"; it lists the user's own content only.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getTikTokVideos,
  type TikTokVideoItem,
  type TikTokFailureCode,
} from "@/services/tiktokOAuth";

export interface TikTokVideosState {
  loading: boolean;
  loadingMore: boolean;
  videos: TikTokVideoItem[];
  cursor?: number;
  hasMore: boolean;
  /** Typed failure so the screen can render the right call to action. */
  errorCode: TikTokFailureCode | null;
  errorMessage: string | null;
}

const PAGE_SIZE = 20;

const initialState: TikTokVideosState = {
  loading: true,
  loadingMore: false,
  videos: [],
  cursor: undefined,
  hasMore: false,
  errorCode: null,
  errorMessage: null,
};

export function useTikTokVideos() {
  const [state, setState] = useState<TikTokVideosState>(initialState);

  const fetchPage = useCallback(async (cursor?: number) => {
    const isFirst = cursor === undefined;
    setState(prev => ({
      ...prev,
      loading: isFirst ? true : prev.loading,
      loadingMore: isFirst ? false : true,
      errorCode: isFirst ? null : prev.errorCode,
      errorMessage: isFirst ? null : prev.errorMessage,
    }));

    const res = await getTikTokVideos({ cursor, maxCount: PAGE_SIZE });

    if (!res.ok) {
      setState(prev => ({
        ...prev,
        loading: false,
        loadingMore: false,
        errorCode: res.code,
        errorMessage: res.message,
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: false,
      loadingMore: false,
      errorCode: null,
      errorMessage: null,
      videos: isFirst ? res.data.videos : [...prev.videos, ...res.data.videos],
      cursor: res.data.cursor,
      hasMore: res.data.hasMore,
    }));
  }, []);

  const reload = useCallback(() => fetchPage(undefined), [fetchPage]);

  const loadMore = useCallback(() => {
    setState(prev => {
      if (prev.loadingMore || !prev.hasMore) return prev;
      // Trigger the next page outside the updater to avoid double calls.
      void fetchPage(prev.cursor);
      return prev;
    });
  }, [fetchPage]);

  useEffect(() => {
    fetchPage(undefined);
  }, [fetchPage]);

  return { ...state, reload, loadMore };
}
