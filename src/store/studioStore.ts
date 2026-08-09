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

function emptyMetrics(): PostMetrics {
  // Aucune métrique inventée : les vrais compteurs viennent du backend
  // (studioService.getAnalytics / getTopVideos). Le store ne conserve que le
  // contenu créé par l'utilisateur dans l'éditeur.
  return { views: 0, likes: 0, comments: 0, shares: 0, dailyViews: [0, 0, 0, 0, 0, 0, 0] };
}

export const useStudioStore = create<StudioStore>((set, get) => ({
  posts: [],
  withdrawnTotal: 0,

  addPost: post => {
    const created: MediaPost = {
      id: `media-${mediaSeq++}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      metrics: emptyMetrics(),
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
    // Fallback local à ZÉRO (jamais de chiffres inventés). Les vraies
    // analytics sont chargées depuis le backend par useCreatorAnalytics ;
    // si l'API est indisponible, ce fallback affiche 0 au lieu de simuler.
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
    return {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      followers: 0,
      followersGained7d: 0,
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
