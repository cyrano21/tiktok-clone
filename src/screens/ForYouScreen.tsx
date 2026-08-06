import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Dimensions, RefreshControl, Text, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@/theme/tokens';
import { Video } from '@/types';
import { FeedItem } from '@/components/core/FeedItem';
import { useVideoFeed } from '@/hooks/useVideoFeed';
import { useNavigation } from '@/navigation/NavigationContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ForYouScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const {
    videos,
    currentIndex,
    loadingState,
    onViewableItemsChanged,
    viewabilityConfig,
    handleRefresh,
    handleEndReached,
    isRefreshing,
  } = useVideoFeed();

  const renderItem = useCallback(
    ({ item, index }: { item: Video; index: number }) => (
      <FeedItem
        video={item}
        isActive={index === currentIndex}
        itemHeight={containerHeight}
        onCommentPress={() => nav.push('video.comments', { postId: item.id, count: item.commentsCount })}
        onSharePress={() => nav.push('inbox')}
        onProfilePress={() => nav.push('profile')}
        onProductPress={(productId) => nav.push('shop.product', { productId })}
      />
    ),
    [currentIndex, nav]
  );

  const [containerHeight, setContainerHeight] = useState(Dimensions.get('window').height);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerHeight(h);
  }, []);

  const keyExtractor = useCallback((item: Video) => item.id, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: containerHeight,
      offset: containerHeight * index,
      index,
    }),
    [containerHeight]
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => nav.replace('feed.following')}>
          <Text style={styles.headerTab}>Following</Text>
        </TouchableOpacity>
        <View style={styles.headerDivider} />
        <TouchableOpacity>
          <Text style={[styles.headerTab, styles.headerTabActive]}>For You</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={containerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
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
        initialNumToRender={2}
      />

      {loadingState === 'loading' && videos.length === 0 && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.black,
  },
  loadingText: {
    color: tokens.colors.white,
    fontSize: tokens.typography.body.fontSize,
  },
});
