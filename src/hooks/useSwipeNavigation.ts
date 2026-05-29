import { useCallback } from 'react';
import { useFeedStore } from '@/store/feedStore';

export function useSwipeNavigation() {
  const { videos, currentIndex, setCurrentIndex } = useFeedStore();

  const navigateToNext = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, videos.length, setCurrentIndex]);

  const navigateToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, setCurrentIndex]);

  const canGoNext = currentIndex < videos.length - 1;
  const canGoPrev = currentIndex > 0;

  return {
    navigateToNext,
    navigateToPrev,
    canGoNext,
    canGoPrev,
    currentIndex,
    totalVideos: videos.length,
  };
}
