import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean slate
  await prisma.notification.deleteMany();
  await prisma.liveGift.deleteMany();
  await prisma.liveStream.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.videoView.deleteMany();
  await prisma.save.deleteMany();
  await prisma.share.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.videoHashtag.deleteMany();
  await prisma.hashtag.deleteMany();
  await prisma.sound.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.video.deleteMany();
  await prisma.user.deleteMany();

  // ---- Users ----
  const passwordHash = await bcrypt.hash('password123', 12);
  const creators = [
    { username: 'leamartin', displayName: 'Léa Martin', bio: 'Créatrice contenu lifestyle 🌸', isVerified: true },
    { username: 'thomas.k', displayName: 'Thomas K.', bio: 'Voyage · Photo · Run', isVerified: false },
    { username: 'studio.flow', displayName: 'Studio Flow', bio: 'Studio créatif · Paris', isVerified: true },
    { username: 'naelle_', displayName: 'Naëlle', bio: 'Mode · Beauty · Vlogs', isVerified: false },
    { username: 'maxence_off', displayName: 'Maxence', bio: 'Comedy · Sketches · 🇫🇷', isVerified: true },
    { username: 'la.cheffe', displayName: 'La Cheffe', bio: 'Recettes faciles 🍳', isVerified: false },
    { username: 'pierre.dance', displayName: 'Pierre Dance', bio: 'Choreographer · Worldwide', isVerified: true },
    { username: 'mia.sunset', displayName: 'Mia Sunset', bio: 'Travel diaries 🌍', isVerified: false },
    { username: 'kev_skate', displayName: 'Kevin Skate', bio: 'Skate every day 🛹', isVerified: false },
    { username: 'amelie_yoga', displayName: 'Amélie Yoga', bio: 'Yoga · Meditation', isVerified: true },
    { username: 'demo', displayName: 'Demo User', bio: 'Compte de démonstration', isVerified: false },
  ];

  const avatarSeeds = [47, 12, 68, 32, 15, 45, 8, 24, 11, 49, 5];
  const users = [];
  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];
    const followerCount = Math.floor(Math.random() * 1500000) + 1500;
    const user = await prisma.user.create({
      data: {
        email: `${c.username}@demo.app`,
        username: c.username,
        passwordHash,
        displayName: c.displayName,
        bio: c.bio,
        avatarUrl: `https://i.pravatar.cc/200?img=${avatarSeeds[i]}`,
        coverUrl: `https://picsum.photos/seed/cover${i}/900/400`,
        isVerified: c.isVerified,
        followerCount,
        followingCount: Math.floor(Math.random() * 800) + 50,
        videoCount: Math.floor(Math.random() * 460) + 20,
        likeCount: BigInt(Math.floor(Math.random() * 12000000) + 10000),
      },
    });
    users.push(user);
  }

  const demoUser = users[users.length - 1];

  // ---- Follows ----
  for (const u of users) {
    if (u.id === demoUser.id) continue;
    await prisma.follow.create({ data: { followerId: demoUser.id, followingId: u.id } });
  }

  // ---- Sounds ----
  const sounds = [];
  const soundData = [
    { title: 'Espresso', artist: 'Sabrina Carpenter' },
    { title: 'Son original', artist: 'leamartin' },
    { title: 'Cruel Summer', artist: 'Taylor Swift' },
    { title: 'Mon Amour', artist: 'Slimane' },
    { title: 'Flowers', artist: 'Miley Cyrus' },
  ];
  for (let i = 0; i < soundData.length; i++) {
    const s = soundData[i];
    const sound = await prisma.sound.create({
      data: {
        title: s.title,
        artist: s.artist,
        audioUrl: '',
        coverUrl: `https://picsum.photos/seed/sound${i + 1}/100`,
        duration: Math.floor(Math.random() * 20) + 20,
        videoCount: BigInt(Math.floor(Math.random() * 2300000) + 10000),
        isOriginal: s.title === 'Son original',
        creatorId: s.title === 'Son original' ? users[0].id : null,
      },
    });
    sounds.push(sound);
  }

  // ---- Hashtags ----
  const hashtagNames = ['fyp', 'pourtoi', 'viral', 'aesthetic', 'fr', 'dance', 'comedy', 'travel', 'food', 'lifestyle', 'tutorial', 'asmr', 'sunset', 'streetstyle'];
  const hashtags = [];
  for (const name of hashtagNames) {
    const h = await prisma.hashtag.create({
      data: {
        name,
        videoCount: BigInt(Math.floor(Math.random() * 500000) + 10000),
        viewCount: BigInt(Math.floor(Math.random() * 50000000) + 1000000),
      },
    });
    hashtags.push(h);
  }

  // ---- Videos ----
  const sampleVideos = [
    { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4', thumb: 'https://picsum.photos/seed/bb1/720/1280' },
    { url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', thumb: 'https://picsum.photos/seed/sintel/720/1280' },
    { url: 'https://media.w3.org/2010/05/video/movie_300.mp4', thumb: 'https://picsum.photos/seed/movie/720/1280' },
    { url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4', thumb: 'https://picsum.photos/seed/jelly/720/1280' },
    { url: 'https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4', thumb: 'https://picsum.photos/seed/sintel2/720/1280' },
  ];

  const captions = [
    'On a tenté ce nouveau spot 🌅 incroyable lumière ce matin',
    'POV : tu testes la recette virale 🍝 ça change la vie',
    'Tutoriel express en 30 secondes — sauvegarde pour plus tard',
    'Cette routine matinale a tout changé pour moi 🌿',
    'Quand le rythme arrive juste au bon moment 🎶',
    'On filme tout en une prise — pas de coupure',
  ];

  const videos = [];
  for (let i = 0; i < 20; i++) {
    const creator = users[i % (users.length - 1)];
    const sample = sampleVideos[i % sampleVideos.length];
    const video = await prisma.video.create({
      data: {
        userId: creator.id,
        title: captions[i % captions.length].slice(0, 80),
        description: captions[i % captions.length],
        videoUrl: sample.url,
        thumbnailUrl: sample.thumb,
        coverUrl: sample.thumb,
        duration: 10,
        width: 720,
        height: 1280,
        visibility: 'public',
        viewCount: BigInt(Math.floor(Math.random() * 12000000) + 50000),
        likeCount: BigInt(Math.floor(Math.random() * 980000) + 2400),
        commentCount: BigInt(Math.floor(Math.random() * 12000) + 40),
        shareCount: BigInt(Math.floor(Math.random() * 32000) + 20),
        saveCount: BigInt(Math.floor(Math.random() * 48000) + 10),
        soundId: sounds[i % sounds.length].id,
      },
    });
    videos.push(video);
  }

  // ---- VideoHashtags ----
  for (const video of videos) {
    const count = (video.id.charCodeAt(video.id.length - 1) % 3) + 1;
    for (let j = 0; j < count; j++) {
      const h = hashtags[(j + video.id.length) % hashtags.length];
      await prisma.videoHashtag.create({ data: { videoId: video.id, hashtagId: h.id } });
    }
  }

  // ---- Comments ----
  const commentTexts = [
    'Incroyable 😍',
    'Je suis fan !!',
    'Comment tu fais ça ?',
    'Trop bien, je partage 🔥',
    'Le rythme est parfait 🎶',
    'Enfin une vraie perle',
    'Je valide à 100% 👏',
    'Ça change la vie franchement',
  ];
  for (let i = 0; i < 40; i++) {
    const video = videos[i % videos.length];
    const user = users[i % (users.length - 1)];
    await prisma.comment.create({
      data: {
        userId: user.id,
        videoId: video.id,
        text: commentTexts[i % commentTexts.length],
        likeCount: Math.floor(Math.random() * 500),
      },
    });
  }

  console.log('✅ Seeding complete!');
  console.log(`   ${users.length} users, ${videos.length} videos, ${sounds.length} sounds, ${hashtags.length} hashtags`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
