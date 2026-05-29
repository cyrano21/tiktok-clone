import { create } from "zustand";

export type MediaType = "video" | "image";

export interface MediaFilters {
  brightness: number; // %
  contrast: number; // %
  saturate: number; // %
  sepia: number; // %
  grayscale: number; // %
}

export const DEFAULT_FILTERS: MediaFilters = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  sepia: 0,
  grayscale: 0,
};

export interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  // 7-day daily views, oldest → newest
  dailyViews: number[];
}

export interface MediaPost {
  id: string;
  type: MediaType;
  sourceUrl: string; // object URL or remote URL
  thumbnailUrl: string;
  caption: string;
  overlayText: string;
  filters: MediaFilters;
  trimStart: number;
  trimEnd: number;
  productId?: string; // when this is a product video
  sellerId?: string;
  createdAt: string;
  metrics: PostMetrics;
}

export interface NewMediaPost {
  type: MediaType;
  sourceUrl: string;
  thumbnailUrl: string;
  caption: string;
  overlayText: string;
  filters: MediaFilters;
  trimStart: number;
  trimEnd: number;
  productId?: string;
  sellerId?: string;
}

export interface StudioAnalytics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  followers: number;
  followersGained7d: number;
  engagementRate: number; // %
  dailyViews: number[]; // aggregated 7-day, oldest → newest
  postsCount: number;
}

export interface Monetization {
  available: number; // € withdrawable
  pending: number; // € pending validation
  creatorFund: number; // € earned via fund (lifetime)
  giftsDiamonds: number; // diamonds from gifts
  liveEarnings: number; // € from live
}

interface StudioState {
  posts: MediaPost[];
  withdrawnTotal: number;
}

interface StudioActions {
  addPost: (post: NewMediaPost) => MediaPost;
  removePost: (id: string) => void;
  updateCaption: (id: string, caption: string) => void;
  getPost: (id: string) => MediaPost | undefined;
  postsByProduct: (productId: string) => MediaPost[];
  postsBySeller: (sellerId: string) => MediaPost[];
  analytics: () => StudioAnalytics;
  monetization: () => Monetization;
  withdraw: () => number;
}

type StudioStore = StudioState & StudioActions;

let mediaSeq = 1;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function seedMetrics(base: number): PostMetrics {
  const views = base;
  const likes = Math.round(views * (0.08 + Math.random() * 0.06));
  const comments = Math.round(likes * (0.04 + Math.random() * 0.05));
  const shares = Math.round(likes * (0.03 + Math.random() * 0.04));
  const dailyViews = Array.from({ length: 7 }, () =>
    randomBetween(Math.round(views * 0.04), Math.round(views * 0.22)),
  );
  return { views, likes, comments, shares, dailyViews };
}

// A few pre-existing published videos so the Studio has real content & analytics on first open.
function buildSeedPosts(): MediaPost[] {
  const seeds: Array<{
    thumb: string;
    caption: string;
    base: number;
    days: number;
  }> = [
    {
      thumb: "https://picsum.photos/seed/studio1/360/640",
      caption: "Le spot secret au lever du soleil 🌅",
      base: 184000,
      days: 6,
    },
    {
      thumb: "https://picsum.photos/seed/studio2/360/640",
      caption: "Routine du matin en 30s ☕",
      base: 92300,
      days: 12,
    },
    {
      thumb: "https://picsum.photos/seed/studio3/360/640",
      caption: "Ce trick m'a pris 2 semaines 🔥",
      base: 421500,
      days: 20,
    },
    {
      thumb: "https://picsum.photos/seed/studio4/360/640",
      caption: "Avant / après, vous y croyez ? 😳",
      base: 56700,
      days: 31,
    },
    {
      thumb: "https://picsum.photos/seed/studio5/360/640",
      caption: "Mon setup créateur 2026 🎬",
      base: 248900,
      days: 45,
    },
  ];
  return seeds.map((s, i) => ({
    id: `seed-${i + 1}`,
    type: "video" as MediaType,
    sourceUrl: "",
    thumbnailUrl: s.thumb,
    caption: s.caption,
    overlayText: "",
    filters: DEFAULT_FILTERS,
    trimStart: 0,
    trimEnd: 0,
    createdAt: new Date(Date.now() - s.days * 86_400_000).toISOString(),
    metrics: seedMetrics(s.base),
  }));
}

const BASE_FOLLOWERS = 14200;

export const useStudioStore = create<StudioStore>((set, get) => ({
  posts: buildSeedPosts(),
  withdrawnTotal: 0,

  addPost: post => {
    const created: MediaPost = {
      id: `media-${mediaSeq++}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      metrics: seedMetrics(randomBetween(800, 6400)),
      ...post,
    };
    set(state => ({ posts: [created, ...state.posts] }));
    return created;
  },

  removePost: id =>
    set(state => ({ posts: state.posts.filter(p => p.id !== id) })),

  updateCaption: (id, caption) =>
    set(state => ({
      posts: state.posts.map(p => (p.id === id ? { ...p, caption } : p)),
    })),

  getPost: id => get().posts.find(p => p.id === id),

  postsByProduct: productId =>
    get().posts.filter(p => p.productId === productId),

  postsBySeller: sellerId => get().posts.filter(p => p.sellerId === sellerId),

  analytics: () => {
    const posts = get().posts;
    const totalViews = posts.reduce((s, p) => s + p.metrics.views, 0);
    const totalLikes = posts.reduce((s, p) => s + p.metrics.likes, 0);
    const totalComments = posts.reduce((s, p) => s + p.metrics.comments, 0);
    const totalShares = posts.reduce((s, p) => s + p.metrics.shares, 0);
    const dailyViews = Array.from({ length: 7 }, (_, day) =>
      posts.reduce((s, p) => s + (p.metrics.dailyViews[day] ?? 0), 0),
    );
    const interactions = totalLikes + totalComments + totalShares;
    const engagementRate =
      totalViews > 0 ? (interactions / totalViews) * 100 : 0;
    const followersGained7d = Math.round(
      dailyViews.reduce((a, b) => a + b, 0) * 0.012,
    );
    return {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      followers: BASE_FOLLOWERS + followersGained7d,
      followersGained7d,
      engagementRate,
      dailyViews,
      postsCount: posts.length,
    };
  },

  monetization: () => {
    const { totalViews, totalLikes } = get().analytics();
    // Creator fund ≈ 0.02€ / 1000 views (demo rate)
    const creatorFund = (totalViews / 1000) * 0.02;
    const giftsDiamonds = Math.round(totalLikes * 0.9);
    const liveEarnings = giftsDiamonds * 0.005; // 1 diamond ≈ 0.005€
    const gross = creatorFund + liveEarnings;
    const withdrawn = get().withdrawnTotal;
    const available = Math.max(0, gross * 0.7 - withdrawn);
    const pending = gross * 0.3;
    return {
      available,
      pending,
      creatorFund,
      giftsDiamonds,
      liveEarnings,
    };
  },

  withdraw: () => {
    const amount = get().monetization().available;
    set(state => ({ withdrawnTotal: state.withdrawnTotal + amount }));
    return amount;
  },
}));

export function filtersToCss(f: MediaFilters): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) sepia(${f.sepia}%) grayscale(${f.grayscale}%)`;
}
