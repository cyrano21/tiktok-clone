import { create } from 'zustand';

export interface CommentUser {
  username: string;
  avatarUrl: string;
  badge?: string; // e.g. "Créateur", "LV.20"
}

export interface Reply {
  id: string;
  user: CommentUser;
  text: string;
  createdAtLabel: string;
  likes: number;
  isLiked: boolean;
}

export interface Comment {
  id: string;
  user: CommentUser;
  text: string;
  createdAtLabel: string;
  likes: number;
  isLiked: boolean;
  pinned?: boolean;
  replies: Reply[];
}

interface CommentsState {
  // keyed by postId
  byPost: Record<string, Comment[]>;
}

interface CommentsActions {
  getThread: (postId: string) => Comment[];
  ensureSeed: (postId: string) => void;
  addComment: (postId: string, text: string, me: CommentUser) => void;
  addReply: (postId: string, commentId: string, text: string, me: CommentUser) => void;
  toggleLike: (postId: string, commentId: string, replyId?: string) => void;
  count: (postId: string) => number;
}

type CommentsStore = CommentsState & CommentsActions;

const SEED_USERS: CommentUser[] = [
  { username: 'kani_thompson', avatarUrl: 'https://i.pravatar.cc/100?img=15', badge: 'LV.18' },
  { username: 'this_is_bee', avatarUrl: 'https://i.pravatar.cc/100?img=32' },
  { username: 'www.com', avatarUrl: 'https://i.pravatar.cc/100?img=51' },
  { username: 'lavishy', avatarUrl: 'https://i.pravatar.cc/100?img=24' },
  { username: 'ranveer_taylor', avatarUrl: 'https://i.pravatar.cc/100?img=8', badge: 'LV.20' },
  { username: 'omar', avatarUrl: 'https://i.pravatar.cc/100?img=12' },
  { username: 'sofia.lens', avatarUrl: 'https://i.pravatar.cc/100?img=45' },
  { username: 'th_eo', avatarUrl: 'https://i.pravatar.cc/100?img=11' },
];

function u(i: number): CommentUser {
  return SEED_USERS[i % SEED_USERS.length];
}

let idSeq = 1;
const nid = (p: string) => `${p}-${idSeq++}`;

function buildSeed(): Comment[] {
  return [
    {
      id: nid('c'),
      user: u(0),
      text: "C'est une chanson faite par un artiste belgo-africain qui parle de son père décédé pendant le génocide rwandais. Il est rwandais mais vit en Belgique.",
      createdAtLabel: '1-25',
      likes: 12400,
      isLiked: false,
      pinned: true,
      replies: [
        { id: nid('r'), user: u(5), text: 'Merci pour le contexte 🙏', createdAtLabel: '1-25', likes: 320, isLiked: false },
        { id: nid('r'), user: u(7), text: 'Je ne savais pas, magnifique.', createdAtLabel: '1-24', likes: 88, isLiked: false },
      ],
    },
    {
      id: nid('c'),
      user: u(1),
      text: 'who else loves this version more',
      createdAtLabel: '1-17',
      likes: 3600,
      isLiked: false,
      replies: Array.from({ length: 3 }, (_, i) => ({
        id: nid('r'),
        user: u(i + 2),
        text: ['Cette version est incroyable', 'me 🙋', 'facile la meilleure'][i],
        createdAtLabel: '1-17',
        likes: 120 - i * 30,
        isLiked: false,
      })),
    },
    {
      id: nid('c'),
      user: u(2),
      text: 'performance for world cup 🔥😎',
      createdAtLabel: '1-16',
      likes: 4200,
      isLiked: false,
      replies: [
        { id: nid('r'), user: u(4), text: 'oui carrément', createdAtLabel: '1-16', likes: 54, isLiked: false },
      ],
    },
    {
      id: nid('c'),
      user: u(3),
      text: 'So this is not a gospel song … my aunt prays listening to this song',
      createdAtLabel: '1-19',
      likes: 980,
      isLiked: false,
      replies: [],
    },
    {
      id: nid('c'),
      user: u(4),
      text: 'What is this language?',
      createdAtLabel: '1-18',
      likes: 210,
      isLiked: false,
      replies: [
        { id: nid('r'), user: u(5), text: 'french song, covered by congolese, the song', createdAtLabel: '1-18', likes: 75, isLiked: false },
      ],
    },
  ];
}

export const useCommentsStore = create<CommentsStore>((set, get) => ({
  byPost: {},

  ensureSeed: (postId) => {
    if (!get().byPost[postId]) {
      set((state) => ({ byPost: { ...state.byPost, [postId]: buildSeed() } }));
    }
  },

  getThread: (postId) => get().byPost[postId] ?? [],

  addComment: (postId, text, me) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const comment: Comment = {
      id: nid('c'),
      user: me,
      text: trimmed,
      createdAtLabel: "À l'instant",
      likes: 0,
      isLiked: false,
      replies: [],
    };
    set((state) => ({
      byPost: { ...state.byPost, [postId]: [comment, ...(state.byPost[postId] ?? [])] },
    }));
  },

  addReply: (postId, commentId, text, me) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set((state) => ({
      byPost: {
        ...state.byPost,
        [postId]: (state.byPost[postId] ?? []).map((c) =>
          c.id === commentId
            ? {
                ...c,
                replies: [
                  ...c.replies,
                  { id: nid('r'), user: me, text: trimmed, createdAtLabel: "À l'instant", likes: 0, isLiked: false },
                ],
              }
            : c
        ),
      },
    }));
  },

  toggleLike: (postId, commentId, replyId) => {
    set((state) => ({
      byPost: {
        ...state.byPost,
        [postId]: (state.byPost[postId] ?? []).map((c) => {
          if (c.id !== commentId) return c;
          if (replyId) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === replyId
                  ? { ...r, isLiked: !r.isLiked, likes: r.isLiked ? r.likes - 1 : r.likes + 1 }
                  : r
              ),
            };
          }
          return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 };
        }),
      },
    }));
  },

  count: (postId) => {
    const thread = get().byPost[postId] ?? [];
    return thread.reduce((sum, c) => sum + 1 + c.replies.length, 0);
  },
}));
