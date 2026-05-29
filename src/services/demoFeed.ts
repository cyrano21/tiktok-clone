import { Video, FeedResponse, User, Sound, Hashtag } from '@/types';

// Public CC0 / sample videos that actually play in browsers (Google, GTV, mixkit).
const SAMPLE_VIDEOS: { url: string; cover: string }[] = [
  { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4', cover: 'https://picsum.photos/seed/bb1/720/1280' },
  { url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', cover: 'https://picsum.photos/seed/sintel/720/1280' },
  { url: 'https://media.w3.org/2010/05/video/movie_300.mp4', cover: 'https://picsum.photos/seed/movie/720/1280' },
  { url: 'https://media.w3.org/2010/05/bunny/trailer.mp4', cover: 'https://picsum.photos/seed/bunny/720/1280' },
  { url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4', cover: 'https://picsum.photos/seed/jelly/720/1280' },
  { url: 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4', cover: 'https://picsum.photos/seed/sintel2/720/1280' },
  { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_2MB.mp4', cover: 'https://picsum.photos/seed/bb2/720/1280' },
  { url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4', cover: 'https://picsum.photos/seed/jelly2/720/1280' },
];

const CREATORS: Array<Pick<User, 'username' | 'displayName' | 'avatarUrl' | 'bio' | 'isVerified'>> = [
  { username: 'leamartin', displayName: 'Léa Martin', avatarUrl: 'https://i.pravatar.cc/200?img=47', bio: 'Créatrice contenu lifestyle 🌸', isVerified: true },
  { username: 'thomas.k', displayName: 'Thomas K.', avatarUrl: 'https://i.pravatar.cc/200?img=12', bio: 'Voyage · Photo · Run', isVerified: false },
  { username: 'studio.flow', displayName: 'Studio Flow', avatarUrl: 'https://i.pravatar.cc/200?img=68', bio: 'Studio créatif · Paris', isVerified: true },
  { username: 'naelle_', displayName: 'Naëlle', avatarUrl: 'https://i.pravatar.cc/200?img=32', bio: 'Mode · Beauty · Vlogs', isVerified: false },
  { username: 'maxence_off', displayName: 'Maxence', avatarUrl: 'https://i.pravatar.cc/200?img=15', bio: 'Comedy · Sketches · 🇫🇷', isVerified: true },
  { username: 'la.cheffe', displayName: 'La Cheffe', avatarUrl: 'https://i.pravatar.cc/200?img=45', bio: 'Recettes faciles 🍳', isVerified: false },
  { username: 'pierre.dance', displayName: 'Pierre Dance', avatarUrl: 'https://i.pravatar.cc/200?img=8', bio: 'Choreographer · Worldwide', isVerified: true },
  { username: 'mia.sunset', displayName: 'Mia Sunset', avatarUrl: 'https://i.pravatar.cc/200?img=24', bio: 'Travel diaries 🌍', isVerified: false },
  { username: 'kev_skate', displayName: 'Kevin Skate', avatarUrl: 'https://i.pravatar.cc/200?img=11', bio: 'Skate every day 🛹', isVerified: false },
  { username: 'amelie_yoga', displayName: 'Amélie Yoga', avatarUrl: 'https://i.pravatar.cc/200?img=49', bio: 'Yoga · Meditation', isVerified: true },
];

const CAPTIONS: string[] = [
  'On a tenté ce nouveau spot 🌅 incroyable lumière ce matin',
  'POV : tu testes la recette virale 🍝 ça change la vie',
  'Tutoriel express en 30 secondes — sauvegarde pour plus tard',
  'Cette routine matinale a tout changé pour moi 🌿',
  'Quand le rythme arrive juste au bon moment 🎶',
  'Ce trick m’a pris 2 semaines à sortir proprement 🔥',
  'Petit moment calme avant la tempête 💭',
  'Réponse à @creator — voilà comment je fais',
  'On filme tout en une prise — pas de coupure',
  'Le before/after que personne n’attendait 😳',
  'Storytime : ce qui s’est vraiment passé hier',
  '24h dans la peau de … épisode 3',
];

const HASHTAGS_POOL: string[] = ['fyp', 'pourtoi', 'viral', 'aesthetic', 'fr', 'dance', 'comedy', 'travel', 'food', 'lifestyle', 'tutorial', 'asmr', 'sunset', 'streetstyle'];

// Demo product ids that appear as shoppable tags on some feed videos.
const SHOPPABLE_PRODUCT_IDS = ['p1', 'p2', 'p3', 'p5', 'p7', 'p9'];

const SOUNDS: Sound[] = [
  { id: 's1', title: 'Espresso', artist: 'Sabrina Carpenter', coverUrl: 'https://picsum.photos/seed/sound1/100', audioUrl: '', duration: 30, usageCount: 1240000, isOriginal: false },
  { id: 's2', title: 'Son original', artist: 'leamartin', coverUrl: 'https://picsum.photos/seed/sound2/100', audioUrl: '', duration: 28, usageCount: 12400, isOriginal: true },
  { id: 's3', title: 'Cruel Summer', artist: 'Taylor Swift', coverUrl: 'https://picsum.photos/seed/sound3/100', audioUrl: '', duration: 30, usageCount: 2310000, isOriginal: false },
  { id: 's4', title: 'Mon Amour', artist: 'Slimane', coverUrl: 'https://picsum.photos/seed/sound4/100', audioUrl: '', duration: 27, usageCount: 980000, isOriginal: false },
  { id: 's5', title: 'Flowers', artist: 'Miley Cyrus', coverUrl: 'https://picsum.photos/seed/sound5/100', audioUrl: '', duration: 26, usageCount: 1820000, isOriginal: false },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function buildHashtags(seed: number): Hashtag[] {
  const count = (seed % 3) + 1;
  return Array.from({ length: count }, (_, i) => {
    const name = HASHTAGS_POOL[(seed + i) % HASHTAGS_POOL.length];
    return {
      id: `h-${name}`,
      name,
      viewsCount: randomBetween(1_000_000, 50_000_000),
      videosCount: randomBetween(10_000, 500_000),
      isFollowing: false,
    };
  });
}

function buildUser(seed: number): User {
  const c = pick(CREATORS, seed);
  return {
    id: `u-${c.username}`,
    username: c.username,
    displayName: c.displayName,
    avatarUrl: c.avatarUrl,
    bio: c.bio,
    followersCount: randomBetween(1500, 1_500_000),
    followingCount: randomBetween(50, 800),
    likesCount: randomBetween(10_000, 12_000_000),
    videosCount: randomBetween(20, 480),
    isVerified: c.isVerified,
    isFollowing: false,
    isFollowedBy: false,
    createdAt: new Date(Date.now() - randomBetween(30, 900) * 86_400_000).toISOString(),
  };
}

function buildVideo(seed: number): Video {
  const sample = pick(SAMPLE_VIDEOS, seed);
  const sound = pick(SOUNDS, seed);
  // Every 3rd video showcases a real product (shoppable video)
  const productId = seed % 3 === 0 ? SHOPPABLE_PRODUCT_IDS[(seed / 3) % SHOPPABLE_PRODUCT_IDS.length | 0] : undefined;
  return {
    id: `v-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    user: buildUser(seed),
    videoUrl: sample.url,
    thumbnailUrl: sample.cover,
    description: pick(CAPTIONS, seed),
    likesCount: randomBetween(2_400, 980_000),
    commentsCount: randomBetween(40, 12_000),
    sharesCount: randomBetween(20, 32_000),
    savesCount: randomBetween(10, 48_000),
    viewsCount: randomBetween(50_000, 12_000_000),
    duration: randomBetween(12, 60),
    isLiked: Math.random() > 0.7,
    isSaved: Math.random() > 0.85,
    hashtags: buildHashtags(seed),
    sound,
    location: null,
    createdAt: new Date(Date.now() - randomBetween(1, 240) * 3_600_000).toISOString(),
    allowComments: true,
    allowDuet: true,
    allowStitch: true,
    productId,
  };
}

let counter = 0;

export function getDemoFeed(limit = 10): FeedResponse {
  const videos = Array.from({ length: limit }, () => buildVideo(counter++));
  return {
    videos,
    cursor: `c-${counter}`,
    hasMore: true,
  };
}
