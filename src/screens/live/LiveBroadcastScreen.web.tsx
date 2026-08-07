import React, { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useNavigation } from '@/navigation/NavigationContext';
import { liveService, LiveSession } from '@/services/liveService';

function removeAttachedTracks(container: HTMLDivElement | null) {
  if (!container) return;
  for (const media of Array.from(container.querySelectorAll('video, audio'))) media.remove();
}

export const LiveBroadcastScreen: React.FC = () => {
  const nav = useNavigation();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);

  const [title, setTitle] = useState('');
  const [state, setState] = useState<'setup' | 'connecting' | 'live' | 'ending'>('setup');
  const [viewerCount, setViewerCount] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncViewerCount = (room: Room) => setViewerCount(room.remoteParticipants.size);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) room.disconnect(true);
      removeAttachedTracks(mediaRef.current);
    };
  }, []);

  const attachLocalCamera = (room: Room) => {
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track;
    if (!track || !mediaRef.current) return;
    const element = track.attach();
    if (element instanceof HTMLVideoElement) {
      element.autoplay = true;
      element.muted = true;
      element.playsInline = true;
      element.style.width = '100%';
      element.style.height = '100%';
      element.style.objectFit = 'cover';
      element.style.transform = 'scaleX(-1)';
    }
    removeAttachedTracks(mediaRef.current);
    mediaRef.current.appendChild(element);
  };

  const startLive = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || state !== 'setup') return;

    setState('connecting');
    setError(null);
    try {
      const session = await liveService.start(cleanTitle);
      const room = new Room({ adaptiveStream: true, dynacast: true });
      sessionRef.current = session;
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, () => syncViewerCount(room));
      room.on(RoomEvent.ParticipantDisconnected, () => syncViewerCount(room));
      room.on(RoomEvent.Disconnected, () => {
        if (state !== 'ending') setViewerCount(0);
      });
      room.on(RoomEvent.MediaDevicesError, (mediaError) => {
        setError(`Accès caméra/micro impossible : ${mediaError.message}`);
      });

      await room.connect(session.connection.serverUrl, session.connection.token);
      // This prompts once for both permissions when supported, then publishes the
      // actual camera + microphone tracks to the LiveKit SFU.
      await room.localParticipant.enableCameraAndMicrophone();
      attachLocalCamera(room);
      syncViewerCount(room);
      setMicEnabled(room.localParticipant.isMicrophoneEnabled);
      setCameraEnabled(room.localParticipant.isCameraEnabled);
      setState('live');
    } catch (requestError: any) {
      const room = roomRef.current;
      if (room) room.disconnect(true);
      roomRef.current = null;
      sessionRef.current = null;
      setState('setup');
      setError(
        requestError?.response?.data?.message ||
        requestError?.message ||
        'Impossible de démarrer le live.'
      );
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
    } catch (mediaError: any) {
      setError(mediaError?.message || 'Impossible de modifier le microphone.');
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      if (next) attachLocalCamera(room);
      else removeAttachedTracks(mediaRef.current);
    } catch (mediaError: any) {
      setError(mediaError?.message || 'Impossible de modifier la caméra.');
    }
  };

  const endLive = async () => {
    if (state === 'ending') return;
    setState('ending');
    const session = sessionRef.current;
    try {
      if (session) await liveService.end(session.stream.id);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Le live a été coupé localement, mais sa clôture serveur a échoué.');
    } finally {
      roomRef.current?.disconnect(true);
      roomRef.current = null;
      sessionRef.current = null;
      removeAttachedTracks(mediaRef.current);
      nav.back();
    }
  };

  return (
    <main style={styles.page}>
      <div ref={mediaRef} style={styles.videoStage} />
      {state !== 'live' && <div style={styles.previewEmpty}>Caméra inactive</div>}

      <header style={styles.header}>
        <button type="button" onClick={() => void (state === 'live' ? endLive() : nav.back())} style={styles.iconButton}>×</button>
        {state === 'live' && (
          <div style={styles.liveBadge}>
            <span style={styles.liveDot} /> LIVE · {viewerCount} spectateur{viewerCount > 1 ? 's' : ''}
          </div>
        )}
      </header>

      {state === 'setup' || state === 'connecting' ? (
        <section style={styles.setupCard}>
          <div style={styles.eyebrow}>DIFFUSION WEBRTC</div>
          <h1 style={styles.title}>Démarrer un live réel</h1>
          <p style={styles.copy}>La caméra et le microphone seront publiés via LiveKit. Aucun faux compteur ni aperçu simulé.</p>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Titre du live"
            disabled={state === 'connecting'}
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="button"
            onClick={() => void startLive()}
            disabled={!title.trim() || state === 'connecting'}
            style={{ ...styles.primary, opacity: !title.trim() || state === 'connecting' ? 0.5 : 1 }}
          >
            {state === 'connecting' ? 'Connexion au serveur vidéo…' : 'Autoriser caméra + micro et passer en LIVE'}
          </button>
        </section>
      ) : (
        <footer style={styles.controls}>
          {error && <div style={styles.liveError}>{error}</div>}
          <button type="button" onClick={() => void toggleMicrophone()} style={styles.controlButton}>
            {micEnabled ? 'Micro activé' : 'Micro coupé'}
          </button>
          <button type="button" onClick={() => void toggleCamera()} style={styles.controlButton}>
            {cameraEnabled ? 'Caméra activée' : 'Caméra coupée'}
          </button>
          <button type="button" onClick={() => void endLive()} style={styles.endButton}>
            {state === 'ending' ? 'Fin…' : 'Terminer'}
          </button>
        </footer>
      )}
    </main>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: { position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden', background: '#050505', color: '#fff' },
  videoStage: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, #262626, #050505 65%)' },
  previewEmpty: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#777', fontSize: 14, pointerEvents: 'none' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'max(16px, env(safe-area-inset-top)) 16px 16px', zIndex: 5 },
  iconButton: { width: 42, height: 42, borderRadius: 21, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 26, cursor: 'pointer' },
  liveBadge: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 999, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(14px)', fontWeight: 750, fontSize: 13 },
  liveDot: { width: 8, height: 8, borderRadius: 99, background: '#fe2c55', boxShadow: '0 0 0 4px rgba(254,44,85,.18)' },
  setupCard: { position: 'absolute', left: '50%', bottom: 'max(22px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', width: 'min(560px, calc(100% - 28px))', padding: 22, borderRadius: 24, border: '1px solid rgba(255,255,255,.10)', background: 'rgba(15,15,15,.92)', boxShadow: '0 24px 80px rgba(0,0,0,.55)', backdropFilter: 'blur(22px)', zIndex: 4 },
  eyebrow: { color: '#25f4ee', fontSize: 11, fontWeight: 900, letterSpacing: 1.6 },
  title: { margin: '8px 0 6px', fontSize: 25, lineHeight: 1.12 },
  copy: { margin: '0 0 16px', color: '#aaa', fontSize: 14, lineHeight: 1.45 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #333', borderRadius: 14, background: '#151515', color: '#fff', padding: '14px 15px', outline: 'none', fontSize: 15 },
  error: { color: '#ff7b91', fontSize: 13, lineHeight: 1.4 },
  primary: { width: '100%', marginTop: 14, border: 0, borderRadius: 14, padding: '14px 16px', background: '#fe2c55', color: '#fff', fontWeight: 800, cursor: 'pointer' },
  controls: { position: 'absolute', left: '50%', bottom: 'max(20px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', width: 'min(720px, calc(100% - 28px))', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, padding: 12, borderRadius: 22, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(18px)', zIndex: 5 },
  controlButton: { border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '11px 15px', background: 'rgba(255,255,255,.09)', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  endButton: { border: 0, borderRadius: 999, padding: '11px 18px', background: '#fe2c55', color: '#fff', fontWeight: 850, cursor: 'pointer' },
  liveError: { flexBasis: '100%', color: '#ff8ca1', textAlign: 'center', fontSize: 12 },
};
