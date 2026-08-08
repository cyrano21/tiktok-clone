import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Dimensions, RefreshControl, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { Video } from '@/types';
import { FeedItem } from '@/components/core/FeedItem';
import { CommentSheet } from '@/components/video/CommentSheet';
import { feedService } from '@/services/feedService';
import { useNavigation } from '@/navigation/NavigationContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FollowingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [commentsVideo, setCommentsVideo] = useState<Video | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const response = await feedService.getFollowingFeed({ limit: 10 });
      setVideos(response.videos);
    } catch (error) {
      console.error('Failed to load following feed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFeed();
    setIsRefreshing(false);
  }, [loadFeed]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerHeight(h);
  }, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: containerHeight,
      offset: containerHeight * index,
      index,
    }),
    [containerHeight]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Video; index: number }) => (
      <FeedItem
        video={item}
        isActive={index === currentIndex}
        itemHeight={containerHeight}
        externalPause={commentsVideo !== null}
        onCommentPress={() => setCommentsVideo(item)}
        onSharePress={() => nav.push('inbox')}
        onProfilePress={() => nav.push('profile')}
        onProductPress={(productId) => nav.push('shop.product', { productId })}
      />
    ),
    [currentIndex, nav, containerHeight]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No videos yet</Text>
        <Text style={styles.emptySubtitle}>Follow accounts to see their latest videos here</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => nav.replace('feed.foryou')}>
          <Text style={styles.emptyButtonText}>Explore For You</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => nav.replace('feed.following')}>
          <Text style={[styles.headerTab, styles.headerTabActive]}>Following</Text>
        </TouchableOpacity>
        <View style={styles.headerDivider} />
        <TouchableOpacity onPress={() => nav.replace('feed.foryou')}>
          <Text style={styles.headerTab}>For You</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.colors.white}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
      />

      {commentsVideo && <CommentSheet video={commentsVideo} onClose={() => setCommentsVideo(null)} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  headerTab: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.subhead.fontSize,
    fontWeight: '600',
  },
  headerTabActive: {
    color: tokens.colors.white,
    fontWeight: '700',
  },
  headerDivider: {
    width: 1,
    height: 16,
    backgroundColor: tokens.colors.text.tertiary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: tokens.colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
  },
  emptyTitle: {
    color: tokens.colors.white,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  emptySubtitle: {
    color: tokens.colors.text.secondary,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: tokens.spacing.lg,
    backgroundColor: tokens.colors.brand.primary,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.sm,
  },
  emptyButtonText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
});
