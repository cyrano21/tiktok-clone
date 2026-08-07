import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack } from 'livekit-client';
import { useNavigation, useRouteParams } from '@/navigation/NavigationContext';
import { liveService, type LiveSession, type LiveStreamSummary } from '@/services/liveService';
import { shareText } from '@/services/share';

function clearMedia(container: HTMLDivElement | null) {
  if (!container) return;
  for (const node of Array.from(container.querySelectorAll('video, audio'))) node.remove();
}

function attachRemoteTrack(track: RemoteTrack, container: HTMLDivElement | null) {
  if (!container) return;
  const element = track.attach();
  element.autoplay = true;

  if (element instanceof HTMLVideoElement) {
    element.playsInline = true;
    element.style.position = 'absolute';
    element.style.inset = '0';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.objectFit = 'cover';
    // A live has a single publishing host; replace a prior camera element if the
    // host republishes after device changes/reconnects.
    for (const oldVideo of Array.from(container.querySelectorAll('video'))) oldVideo.remove();
  } else {
    element.style.display = 'none';
  }
  container.appendChild(element);
}

export const LiveScreen: React.FC = () => {
  const nav = useNavigation();
  const { streamId } = useRouteParams<{ streamId?: string }>();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  const [streams, setStreams] = useState<LiveStreamSummary[]>([]);
  const [selected, setSelected] = useState<LiveStreamSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [needsAudioGesture, setNeedsAudioGesture] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    const room = roomRef.current;
    if (room) room.disconnect(true);
    roomRef.current = null;
    sessionRef.current = null;
    clearMedia(mediaRef.current);
    setSelected(null);
    setViewerCount(0);
    setNeedsAudioGesture(false);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStreams(await liveService.list(1, 30));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Impossible de charger les lives.');
    } finally {
      setLoading(false);
    }
  }, []);

  const connectTo = useCallback(async (id: string) => {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    disconnect();

    try {
      const session = await liveService.join(id);
      setSelected(session.stream);
      sessionRef.current = session;

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      const updateCount = () => setViewerCount(Math.max(0, room.numParticipants - 1));
      room.on(RoomEvent.TrackSubscribed, (track) => attachRemoteTrack(track, mediaRef.current));
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        for (const element of track.detach()) element.remove();
      });
      room.on(RoomEvent.ParticipantConnected, updateCount);
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        updateCount();
        if (participant.identity === session.stream.userId) {
          setError('Le créateur a terminé le live.');
          room.disconnect(true);
          setTimeout(() => {
            disconnect();
            void refresh();
          }, 500);
        }
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioGesture(!room.canPlaybackAudio));
      room.on(RoomEvent.Disconnected, () => setViewerCount(0));

      await room.connect(session.connection.serverUrl, session.connection.token);
      updateCount();
      setNeedsAudioGesture(!room.canPlaybackAudio);
    } catch (requestError: any) {
      disconnect();
      setError(requestError?.response?.data?.message || requestError?.message || 'Impossible de rejoindre ce live.');
    } finally {
      setConnecting(false);
    }
  }, [connecting, disconnect, refresh]);

  useEffect(() => {
    void refresh();
    return () => disconnect();
  }, [disconnect, refresh]);

  useEffect(() => {
    if (streamId) void connectTo(streamId);
  }, [streamId]); // connectTo intentionally omitted to avoid reconnecting on state churn.

  const enableAudio = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setNeedsAudioGesture(false);
    } catch (audioError: any) {
      setError(audioError?.message || 'Le navigateur bloque encore la lecture audio.');
    }
  };

  if (selected) {
    return (
      <main style={styles.watchPage}>
        <div ref={mediaRef} style={styles.mediaStage} />
        <div style={styles.noVideo}>Connexion au flux vidéo…</div>

        <header style={styles.watchHeader}>
          <div style={styles.hostPill}>
            {selected.user.avatarUrl ? <img src={selected.user.avatarUrl} alt="" style={styles.avatar} /> : <div style={styles.avatarFallback} />}
            <div>
              <strong>@{selected.user.username}</strong>
              <div style={styles.hostTitle}>{selected.title}</div>
            </div>
            <span style={styles.liveBadge}>LIVE</span>
          </div>
          <div style={styles.headerActions}>
            <span style={styles.viewerBadge}>{viewerCount} en direct</span>
            <button type="button" style={styles.iconButton} onClick={() => {
              disconnect();
              void refresh();
            }}>×</button>
          </div>
        </header>

        <div style={styles.watchControls}>
          {needsAudioGesture && (
            <button type="button" style={styles.audioButton} onClick={() => void enableAudio()}>Activer le son</button>
          )}
          <button type="button" style={styles.secondaryButton} onClick={() => shareText(`Regarde le live de @${selected.user.username}`)}>Partager</button>
        </div>
        {error && <div style={styles.watchError}>{error}</div>}
      </main>
    );
  }

  return (
    <main style={styles.listPage}>
      <header style={styles.listHeader}>
        <button type="button" onClick={() => nav.back()} style={styles.backButton}>←</button>
        <div>
          <div style={styles.eyebrow}>EN DIRECT</div>
          <h1 style={styles.heading}>Lives maintenant</h1>
        </div>
        <button type="button" style={styles.refreshButton} onClick={() => void refresh()}>Actualiser</button>
      </header>

      {error && <div style={styles.listError}>{error}</div>}
      {loading ? (
        <div style={styles.empty}>Chargement des directs…</div>
      ) : streams.length === 0 ? (
        <section style={styles.emptyCard}>
          <div style={styles.emptyTitle}>Aucun live en cours</div>
          <p style={styles.emptyCopy}>Cette page ne fabrique plus de streamer, de chat ou de compteur fictif. Les directs apparaissent seulement lorsqu’un vrai flux LiveKit existe.</p>
          <button type="button" style={styles.primaryButton} onClick={() => nav.push('live.broadcast')}>Démarrer un live</button>
        </section>
      ) : (
        <section style={styles.grid}>
          {streams.map((stream) => (
            <button key={stream.id} type="button" style={styles.card} onClick={() => void connectTo(stream.id)} disabled={connecting}>
              <div style={styles.thumb}>
                {stream.thumbnailUrl ? <img src={stream.thumbnailUrl} alt="" style={styles.thumbImage} /> : <div style={styles.thumbGradient} />}
                <span style={styles.cardLive}>LIVE</span>
                <span style={styles.cardViewers}>{stream.viewerCount} spectateur{stream.viewerCount > 1 ? 's' : ''}</span>
              </div>
              <div style={styles.cardBody}>
                {stream.user.avatarUrl ? <img src={stream.user.avatarUrl} alt="" style={styles.cardAvatar} /> : <div style={styles.cardAvatarFallback} />}
                <div style={{ minWidth: 0 }}>
                  <div style={styles.cardTitle}>{stream.title}</div>
                  <div style={styles.cardUser}>@{stream.user.username}</div>
                </div>
              </div>
            </button>
          ))}
        </section>
      )}
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  listPage: { minHeight: '100dvh', background: '#090909', color: '#fff', padding: 'max(18px, env(safe-area-inset-top)) 18px 34px' },
  listHeader: { maxWidth: 1120, margin: '0 auto 28px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 21, border: '1px solid #262626', background: '#111', color: '#fff', fontSize: 22, cursor: 'pointer' },
  eyebrow: { color: '#F72585', fontSize: 11, fontWeight: 900, letterSpacing: 1.6 },
  heading: { margin: '3px 0 0', fontSize: 27 },
  refreshButton: { border: '1px solid #2a2a2a', borderRadius: 999, background: '#121212', color: '#ddd', padding: '10px 14px', cursor: 'pointer' },
  listError: { maxWidth: 1120, margin: '0 auto 16px', color: '#ff8aa0', background: '#2b1117', borderRadius: 12, padding: 12 },
  empty: { maxWidth: 1120, margin: '80px auto', color: '#888', textAlign: 'center' },
  emptyCard: { maxWidth: 620, margin: '80px auto', padding: 28, borderRadius: 24, background: '#111', border: '1px solid #222', textAlign: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: 850 },
  emptyCopy: { color: '#929292', lineHeight: 1.5 },
  primaryButton: { border: 0, borderRadius: 12, background: '#F72585', color: '#fff', padding: '12px 16px', fontWeight: 800, cursor: 'pointer' },
  grid: { maxWidth: 1120, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  card: { padding: 0, overflow: 'hidden', border: '1px solid #242424', borderRadius: 18, background: '#101010', color: '#fff', textAlign: 'left', cursor: 'pointer' },
  thumb: { position: 'relative', aspectRatio: '9 / 14', overflow: 'hidden', background: '#151515' },
  thumbImage: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbGradient: { width: '100%', height: '100%', background: 'radial-gradient(circle at 40% 25%, #3a242b 0, #171717 42%, #0c0c0c 100%)' },
  cardLive: { position: 'absolute', left: 10, top: 10, background: '#F72585', borderRadius: 6, padding: '4px 7px', fontSize: 10, fontWeight: 900 },
  cardViewers: { position: 'absolute', right: 10, bottom: 10, background: 'rgba(0,0,0,.62)', borderRadius: 999, padding: '5px 8px', fontSize: 11 },
  cardBody: { display: 'flex', gap: 10, alignItems: 'center', padding: 12 },
  cardAvatar: { width: 36, height: 36, borderRadius: 18, objectFit: 'cover' },
  cardAvatarFallback: { width: 36, height: 36, borderRadius: 18, background: '#2b2b2b' },
  cardTitle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800 },
  cardUser: { marginTop: 3, color: '#8e8e8e', fontSize: 12 },
  watchPage: { position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#050505', color: '#fff' },
  mediaStage: { position: 'absolute', inset: 0, background: '#050505', zIndex: 1 },
  noVideo: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#555', zIndex: 0 },
  watchHeader: { position: 'absolute', top: 0, left: 0, right: 0, padding: 'max(14px, env(safe-area-inset-top)) 14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, zIndex: 6 },
  hostPill: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, maxWidth: '70%', padding: '6px 9px 6px 6px', borderRadius: 999, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(16px)' },
  avatar: { width: 36, height: 36, borderRadius: 18, objectFit: 'cover' },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, background: '#333' },
  hostTitle: { color: '#aaa', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  liveBadge: { marginLeft: 5, background: '#F72585', padding: '4px 6px', borderRadius: 5, fontSize: 10, fontWeight: 900 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  viewerBadge: { padding: '8px 10px', borderRadius: 999, background: 'rgba(0,0,0,.62)', fontSize: 12 },
  iconButton: { width: 38, height: 38, border: 0, borderRadius: 19, background: 'rgba(0,0,0,.62)', color: '#fff', fontSize: 22, cursor: 'pointer' },
  watchControls: { position: 'absolute', right: 16, bottom: 'max(18px, env(safe-area-inset-bottom))', display: 'flex', gap: 8, zIndex: 6 },
  audioButton: { border: 0, borderRadius: 999, background: '#7C3AED', color: '#FFFFFF', padding: '11px 14px', fontWeight: 850, cursor: 'pointer' },
  secondaryButton: { border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, background: 'rgba(0,0,0,.62)', color: '#fff', padding: '11px 14px', fontWeight: 750, cursor: 'pointer' },
  watchError: { position: 'absolute', left: 16, bottom: 'max(18px, env(safe-area-inset-bottom))', maxWidth: '65%', borderRadius: 12, background: 'rgba(70,14,27,.88)', color: '#ffb1bf', padding: 10, zIndex: 6, fontSize: 12 },
};
