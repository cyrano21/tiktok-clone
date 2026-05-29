import { useCallback, useEffect, useRef } from 'react';
import { ViewToken } from 'react-native';
import { useFeedStore } from '@/store/feedStore';

export function useVideoFeed() {
  const {
    videos,
    currentIndex,
    loadingState,
    error,
    hasMore,
    loadFeed,
    refreshFeed,
    loadMore,
    setCurrentIndex,
  } = useFeedStore();

  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      loadFeed();
    }
  }, [loadFeed]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [setCurrentIndex]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;

  const handleRefresh = useCallback(() => {
    refreshFeed();
  }, [refreshFeed]);

  const handleEndReached = useCallback(() => {
    if (hasMore && loadingState !== 'loadingMore') {
      loadMore();
    }
  }, [hasMore, loadingState, loadMore]);

  return {
    videos,
    currentIndex,
    loadingState,
    error,
    hasMore,
    onViewableItemsChanged,
    viewabilityConfig,
    handleRefresh,
    handleEndReached,
    isRefreshing: loadingState === 'refreshing',
  };
}
