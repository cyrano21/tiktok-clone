import React from 'react';
import { RouteName } from './NavigationContext';

import { ForYouScreen } from '@/screens/ForYouScreen';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { CreateScreen } from '@/screens/CreateScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { FollowingScreen } from '@/screens/feed/FollowingScreen';
import { SearchScreen } from '@/screens/explore/SearchScreen';
import { HashtagScreen } from '@/screens/explore/HashtagScreen';
import { SoundScreen } from '@/screens/explore/SoundScreen';
import { TrendRadarScreen } from '@/screens/explore/TrendRadarScreen';
import { RecordScreen } from '@/screens/create/RecordScreen';
import { EditScreen } from '@/screens/create/EditScreen';
import { PublishScreen } from '@/screens/create/PublishScreen';
import { ShopScreen } from '@/screens/shop/ShopScreen';
import { ProductScreen } from '@/screens/shop/ProductScreen';
import { CartScreen } from '@/screens/shop/CartScreen';
import { SellerShopScreen } from '@/screens/shop/SellerShopScreen';
import { SellerDashboardScreen } from '@/screens/shop/SellerDashboardScreen';
import { ProductEditorScreen } from '@/screens/shop/ProductEditorScreen';
import { CheckoutScreen } from '@/screens/shop/CheckoutScreen';
import { ImageGeneratorScreen } from '@/screens/shop/ImageGeneratorScreen';
import { OrdersScreen } from '@/screens/shop/OrdersScreen';
import { MediaEditorScreen } from '@/screens/studio/MediaEditorScreen';
import { StudioHubScreen } from '@/screens/studio/StudioHubScreen';
import { StudioAnalyticsScreen } from '@/screens/studio/StudioAnalyticsScreen';
import { StudioMonetizationScreen } from '@/screens/studio/StudioMonetizationScreen';
import { StudioContentScreen } from '@/screens/studio/StudioContentScreen';
import { StudioPostScreen } from '@/screens/studio/StudioPostScreen';
import { TikTokVideosScreen } from '@/screens/studio/TikTokVideosScreen';
import { StudioBillingScreen } from '@/screens/studio/StudioBillingScreen';
import { StudioCrossPostScreen } from '@/screens/studio/StudioCrossPostScreen';
import { StudioBrandingScreen } from '@/screens/studio/StudioBrandingScreen';
import { StudioScraperScreen } from '@/screens/studio/StudioScraperScreen';
import { CommentsScreen } from '@/screens/video/CommentsScreen';
import { VideoDetailScreen } from '@/screens/VideoDetailScreen';
import { InboxListScreen } from '@/screens/inbox/InboxListScreen';
import { ChatScreen } from '@/screens/inbox/ChatScreen';
import { ActivityScreen } from '@/screens/inbox/ActivityScreen';
import { LiveScreen } from '@/screens/live/LiveScreen';
import { LiveBroadcastScreen } from '@/screens/live/LiveBroadcastScreen';
import { VideoCallScreen } from '@/screens/call/VideoCallScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { SettingsDetailScreen } from '@/screens/profile/SettingsDetailScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';

/**
 * Single source of truth mapping each route to its screen component.
 * Adding a screen = adding one entry here; no router rewrite needed.
 */
export const SCREEN_REGISTRY: Record<RouteName, React.ComponentType> = {
  'feed.foryou': ForYouScreen,
  'feed.following': FollowingScreen,
  explore: ExploreScreen,
  'explore.search': SearchScreen,
  'explore.hashtag': HashtagScreen,
  'explore.sound': SoundScreen,
  'explore.trends': TrendRadarScreen,
  create: CreateScreen,
  'create.record': RecordScreen,
  'create.edit': EditScreen,
  'create.publish': PublishScreen,
  shop: ShopScreen,
  'shop.product': ProductScreen,
  'shop.cart': CartScreen,
  'shop.seller': SellerShopScreen,
  'shop.dashboard': SellerDashboardScreen,
  'shop.product.editor': ProductEditorScreen,
  'shop.checkout': CheckoutScreen,
  'shop.image.generator': ImageGeneratorScreen,
  orders: OrdersScreen,
  'studio.editor': MediaEditorScreen,
  studio: StudioHubScreen,
  'studio.analytics': StudioAnalyticsScreen,
  'studio.monetization': StudioMonetizationScreen,
  'studio.content': StudioContentScreen,
  'studio.post': StudioPostScreen,
  'studio.tiktok': TikTokVideosScreen,
  'studio.billing': StudioBillingScreen,
  'studio.crosspost': StudioCrossPostScreen,
  'studio.branding': StudioBrandingScreen,
  'studio.scraper': StudioScraperScreen,
  'video.comments': CommentsScreen,
  'video.detail': VideoDetailScreen,
  live: LiveScreen,
  'live.broadcast': LiveBroadcastScreen,
  inbox: InboxListScreen,
  'inbox.chat': ChatScreen,
  'inbox.activity': ActivityScreen,
  call: VideoCallScreen,
  profile: ProfileScreen,
  'profile.edit': EditProfileScreen,
  'profile.settings': SettingsScreen,
  'profile.settings.detail': SettingsDetailScreen,
  'auth.login': LoginScreen,
  'auth.register': RegisterScreen,
};

/** Routes that show the main bottom tab bar. */
export const TAB_ROUTES: RouteName[] = ['feed.foryou', 'explore', 'shop', 'create', 'inbox', 'profile'];

/** Maps any route to the tab it belongs under, for active-state highlighting. */
export const ROUTE_TO_TAB: Record<RouteName, RouteName> = {
  'feed.foryou': 'feed.foryou',
  'feed.following': 'feed.foryou',
  explore: 'explore',
  'explore.search': 'explore',
  'explore.hashtag': 'explore',
  'explore.sound': 'explore',
  'explore.trends': 'explore',
  create: 'create',
  'create.record': 'create',
  'create.edit': 'create',
  'create.publish': 'create',
  shop: 'shop',
  'shop.product': 'shop',
  'shop.cart': 'shop',
  'shop.seller': 'shop',
  'shop.dashboard': 'shop',
  'shop.product.editor': 'shop',
  'shop.checkout': 'shop',
  'shop.image.generator': 'shop',
  orders: 'profile',
  'studio.editor': 'create',
  studio: 'profile',
  'studio.analytics': 'profile',
  'studio.monetization': 'profile',
  'studio.content': 'profile',
  'studio.post': 'profile',
  'studio.tiktok': 'profile',
  'studio.billing': 'profile',
  'studio.crosspost': 'profile',
  'studio.branding': 'profile',
  'studio.scraper': 'profile',
  'video.comments': 'feed.foryou',
  'video.detail': 'feed.foryou',
  live: 'feed.foryou',
  'live.broadcast': 'create',
  inbox: 'inbox',
  'inbox.chat': 'inbox',
  'inbox.activity': 'inbox',
  call: 'inbox',
  profile: 'profile',
  'profile.edit': 'profile',
  'profile.settings': 'profile',
  'profile.settings.detail': 'profile',
  'auth.login': 'inbox',
  'auth.register': 'inbox',
};
