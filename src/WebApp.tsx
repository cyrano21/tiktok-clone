import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

type Screen = 'feed' | 'explore' | 'create' | 'profile' | 'login';

// ===== INLINE SCREENS (no external imports to avoid resolution issues) =====

function FeedScreen() {
  return (
    <View style={s.screen}>
      <View style={s.feedBg}>
        <Text style={{ fontSize: 64 }}>🎬</Text>
        <Text style={s.feedTitle}>Pour Toi</Text>
        <Text style={s.feedSub}>Swipe up pour la vidéo suivante</Text>
      </View>
      <View style={s.feedOverlay}>
        <Text style={s.username}>@creator_demo</Text>
        <Text style={s.desc}>Ma première vidéo 🔥 #fyp #viral #dance</Text>
        <Text style={s.sound}>🎵 Son Original — @creator_demo</Text>
      </View>
      <View style={s.actions}>
        {[
          { icon: '❤️', count: '12.4K' },
          { icon: '💬', count: '892' },
          { icon: '↗️', count: '2.1K' },
          { icon: '📌', count: '456' },
          { icon: '💎', count: 'Don' },
        ].map((a, i) => (
          <View key={i} style={s.actionItem}>
            <Text style={{ fontSize: 28 }}>{a.icon}</Text>
            <Text style={s.actionCount}>{a.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ExploreScreen() {
  const trending = [
    { name: '#fyp', count: '12.5M vidéos', type: '#' },
    { name: '#viral', count: '8.9M vidéos', type: '#' },
    { name: '#dance', count: '7.5M vidéos', type: '#' },
    { name: 'Mon Amour — Slimane', count: '2.3M vidéos', type: '🎵' },
    { name: '#comedy', count: '6.2M vidéos', type: '#' },
    { name: 'Flowers — Miley Cyrus', count: '1.8M vidéos', type: '🎵' },
    { name: '#challenge', count: '4.8M vidéos', type: '#' },
    { name: '#tutorial', count: '4.2M vidéos', type: '#' },
  ];

  return (
    <View style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Découvrir</Text></View>
      <View style={s.searchBar}>
        <Text style={{ fontSize: 14, opacity: 0.5 }}>🔍</Text>
        <Text style={{ color: '#5B5C61', fontSize: 15 }}>Rechercher</Text>
      </View>
      <View style={s.tabs}>
        <View style={[s.tab, s.tabActive]}><Text style={s.tabTextActive}>🔥 Tendances</Text></View>
        <View style={s.tab}><Text style={s.tabText}># Hashtags</Text></View>
        <View style={s.tab}><Text style={s.tabText}>🎵 Sons</Text></View>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {trending.map((item, i) => (
          <View key={i} style={s.trendItem}>
            <View style={s.trendIcon}><Text style={{ fontSize: 16 }}>{item.type}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.trendName}>{item.name}</Text>
              <Text style={s.trendCount}>{item.count}</Text>
            </View>
            <Text style={{ color: '#5B5C61', fontSize: 20 }}>›</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function CreateScreen() {
  const options = [
    { icon: '🎥', label: 'Filmer', sub: 'Nouvelle vidéo' },
    { icon: '📤', label: 'Importer', sub: 'Depuis la galerie' },
    { icon: '🔴', label: 'LIVE', sub: 'Démarrer un live' },
    { icon: '✨', label: 'Template', sub: 'Utiliser un modèle' },
    { icon: '👥', label: 'Duo', sub: 'Faire un duo' },
    { icon: '✂️', label: 'Stitch', sub: 'Faire un stitch' },
  ];
  return (
    <View style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>Créer</Text></View>
      <View style={s.createGrid}>
        {options.map((o, i) => (
          <View key={i} style={s.createCard}>
            <View style={s.createIcon}><Text style={{ fontSize: 24 }}>{o.icon}</Text></View>
            <Text style={s.createLabel}>{o.label}</Text>
            <Text style={s.createSub}>{o.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={s.screen}>
      <View style={s.header}><Text style={s.headerTitle}>@utilisateur_test</Text></View>
      <View style={s.profileTop}>
        <View style={s.avatar}><Text style={{ fontSize: 36 }}>👤</Text></View>
        <View style={s.statsRow}>
          <View style={s.stat}><Text style={s.statNum}>47</Text><Text style={s.statLabel}>Vidéos</Text></View>
          <View style={s.stat}><Text style={s.statNum}>12.4K</Text><Text style={s.statLabel}>Abonnés</Text></View>
          <View style={s.stat}><Text style={s.statNum}>892</Text><Text style={s.statLabel}>Abonnements</Text></View>
          <View style={s.stat}><Text style={s.statNum}>45.2K</Text><Text style={s.statLabel}>Likes</Text></View>
        </View>
        <Text style={s.bio}>Créateur de contenu | 🇫🇷{'\n'}Business: contact@test.com</Text>
        <View style={s.profileBtns}>
          <View style={s.profileBtn}><Text style={s.profileBtnText}>Modifier le profil</Text></View>
          <View style={s.profileBtn}><Text style={s.profileBtnText}>Partager</Text></View>
        </View>
      </View>
      <View style={s.gridRow}>
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={[s.gridItem, { backgroundColor: ['#FE2C55', '#25F4EE', '#FFD700', '#FF6B81', '#2D8CF0', '#2ED573'][i % 6] }]}>
            <Text style={s.gridViews}>▶ {Math.floor(Math.random() * 50 + 1)}K</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LoginScreen() {
  return (
    <View style={[s.screen, { justifyContent: 'center', paddingHorizontal: 24 }]}>
      <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>🎵</Text>
      <Text style={s.loginTitle}>Connexion</Text>
      <Text style={s.loginSub}>Connecte-toi pour continuer</Text>
      <View style={s.inputWrap}>
        <Text style={s.inputLabel}>Email ou nom d'utilisateur</Text>
        <View style={s.input}><Text style={{ color: '#5B5C61' }}>Entre ton identifiant</Text></View>
      </View>
      <View style={s.inputWrap}>
        <Text style={s.inputLabel}>Mot de passe</Text>
        <View style={s.input}><Text style={{ color: '#5B5C61' }}>Entre ton mot de passe</Text></View>
      </View>
      <View style={s.loginBtn}><Text style={s.loginBtnText}>Se connecter</Text></View>
      <Text style={{ color: '#8A8B91', textAlign: 'center', marginTop: 24 }}>Pas encore de compte ? <Text style={{ color: '#FE2C55', fontWeight: '700' }}>S'inscrire</Text></Text>
    </View>
  );
}

// ===== MAIN APP =====
export function App() {
  const [screen, setScreen] = useState<Screen>('feed');

  const renderScreen = () => {
    switch (screen) {
      case 'feed': return <FeedScreen />;
      case 'explore': return <ExploreScreen />;
      case 'create': return <CreateScreen />;
      case 'profile': return <ProfileScreen />;
      case 'login': return <LoginScreen />;
    }
  };

  return (
    <View style={s.container}>
      <View style={s.phoneFrame}>
        <View style={{ flex: 1 }}>{renderScreen()}</View>
        <View style={s.nav}>
          {([
            { key: 'feed' as Screen, icon: '🏠', label: 'Accueil' },
            { key: 'explore' as Screen, icon: '🔍', label: 'Découvrir' },
            { key: 'create' as Screen, icon: '➕', label: '' },
            { key: 'login' as Screen, icon: '💬', label: 'Boîte' },
            { key: 'profile' as Screen, icon: '👤', label: 'Profil' },
          ]).map((item) => (
            <TouchableOpacity key={item.key} style={s.navItem} onPress={() => setScreen(item.key)}>
              {item.key === 'create' ? (
                <View style={s.createBtn}><Text style={{ fontSize: 16, color: '#fff' }}>{item.icon}</Text></View>
              ) : (
                <>
                  <Text style={[s.navIcon, screen === item.key && s.navIconActive]}>{item.icon}</Text>
                  <Text style={[s.navLabel, screen === item.key && s.navLabelActive]}>{item.label}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

// ===== STYLES =====
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  phoneFrame: { width: Math.min(width, 430), height: '100%', maxHeight: 932, backgroundColor: '#000', borderRadius: width > 500 ? 40 : 0, overflow: 'hidden', position: 'relative' },
  screen: { flex: 1, backgroundColor: '#121212' },
  // Nav
  nav: { flexDirection: 'row', backgroundColor: '#000', borderTopWidth: 0.5, borderTopColor: '#2A2A2A', paddingVertical: 8, paddingBottom: 20 },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navIcon: { fontSize: 22, opacity: 0.5 },
  navIconActive: { opacity: 1 },
  navLabel: { fontSize: 10, color: '#8A8B91' },
  navLabelActive: { color: '#fff', fontWeight: '600' },
  createBtn: { width: 44, height: 30, borderRadius: 8, backgroundColor: '#FE2C55', justifyContent: 'center', alignItems: 'center' },
  // Feed
  feedBg: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a1f' },
  feedTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 12 },
  feedSub: { fontSize: 13, color: '#8A8B91', marginTop: 6 },
  feedOverlay: { position: 'absolute', bottom: 80, left: 16, right: 80 },
  username: { fontSize: 16, fontWeight: '700', color: '#fff' },
  desc: { fontSize: 14, color: '#fff', marginTop: 4 },
  sound: { fontSize: 13, color: '#fff', marginTop: 6 },
  actions: { position: 'absolute', right: 12, bottom: 100, gap: 16, alignItems: 'center' },
  actionItem: { alignItems: 'center', gap: 2 },
  actionCount: { fontSize: 12, color: '#fff', fontWeight: '600' },
  // Header
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  // Search
  searchBar: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#1E1E1E', borderRadius: 12, paddingHorizontal: 14, height: 40, alignItems: 'center', gap: 10 },
  // Tabs
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#1E1E1E' },
  tabActive: { backgroundColor: '#FE2C55' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8A8B91' },
  tabTextActive: { fontSize: 13, fontWeight: '600', color: '#fff' },
  // Trending
  trendItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  trendIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center' },
  trendName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  trendCount: { fontSize: 12, color: '#8A8B91', marginTop: 2 },
  // Create
  createGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
  createCard: { width: '46%', backgroundColor: '#1E1E1E', borderRadius: 16, padding: 18, gap: 6 },
  createIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2A2A2A', justifyContent: 'center', alignItems: 'center' },
  createLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  createSub: { fontSize: 12, color: '#8A8B91' },
  // Profile
  profileTop: { alignItems: 'center', paddingHorizontal: 20, gap: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E1E1E', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 11, color: '#8A8B91' },
  bio: { fontSize: 13, color: '#fff', textAlign: 'center', lineHeight: 18 },
  profileBtns: { flexDirection: 'row', gap: 8 },
  profileBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E1E1E' },
  profileBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 1, gap: 1, marginTop: 16 },
  gridItem: { width: '32.8%', aspectRatio: 0.75, borderRadius: 4, justifyContent: 'flex-end', padding: 4 },
  gridViews: { fontSize: 11, color: '#fff', fontWeight: '600' },
  // Login
  loginTitle: { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' },
  loginSub: { fontSize: 14, color: '#8A8B91', textAlign: 'center', marginTop: 6, marginBottom: 32 },
  inputWrap: { marginBottom: 16, gap: 6 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#8A8B91' },
  input: { backgroundColor: '#1E1E1E', borderRadius: 12, paddingHorizontal: 16, height: 48, justifyContent: 'center' },
  loginBtn: { height: 48, borderRadius: 12, backgroundColor: '#FE2C55', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
