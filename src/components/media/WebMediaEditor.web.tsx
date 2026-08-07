import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MediaFilters, DEFAULT_FILTERS, filtersToCss, MediaType } from '@/store/studioStore';

export interface EditorResult {
  type: MediaType;
  sourceUrl: string;
  thumbnailUrl: string;
  overlayText: string;
  filters: MediaFilters;
  trimStart: number;
  trimEnd: number;
}

interface Props {
  onExport: (result: EditorResult) => void;
  productMode?: boolean;
}

type Source =
  | { kind: 'none' }
  | { kind: 'image'; url: string; isObjectUrl: boolean }
  | { kind: 'video'; url: string; isObjectUrl: boolean };

const ALLOWED_MEDIA_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const FILTER_PRESETS: { id: string; label: string; filters: MediaFilters }[] = [
  { id: 'none', label: 'Original', filters: DEFAULT_FILTERS },
  { id: 'vivid', label: 'Vif', filters: { brightness: 108, contrast: 118, saturate: 150, sepia: 0, grayscale: 0 } },
  { id: 'mono', label: 'N&B', filters: { brightness: 105, contrast: 110, saturate: 0, sepia: 0, grayscale: 100 } },
  { id: 'warm', label: 'Chaud', filters: { brightness: 105, contrast: 105, saturate: 120, sepia: 35, grayscale: 0 } },
  { id: 'cool', label: 'Froid', filters: { brightness: 100, contrast: 110, saturate: 90, sepia: 0, grayscale: 10 } },
  { id: 'fade', label: 'Fade', filters: { brightness: 112, contrast: 88, saturate: 80, sepia: 12, grayscale: 0 } },
];

export const WebMediaEditor: React.FC<Props> = ({ onExport, productMode }) => {
  const [source, setSource] = useState<Source>({ kind: 'none' });
  const [filters, setFilters] = useState<MediaFilters>(DEFAULT_FILTERS);
  const [overlayText, setOverlayText] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sourceRef = useRef<Source>({ kind: 'none' });

  const setOwnedSource = useCallback((next: Source) => {
    const previous = sourceRef.current;
    if (previous.kind !== 'none' && previous.isObjectUrl && previous.url !== (next.kind !== 'none' ? next.url : '')) {
      URL.revokeObjectURL(previous.url);
    }
    sourceRef.current = next;
    setSource(next);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      const current = sourceRef.current;
      if (current.kind !== 'none' && current.isObjectUrl) URL.revokeObjectURL(current.url);
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      stopCamera();
    };
  }, [stopCamera]);

  const resetEditing = () => {
    setFilters(DEFAULT_FILTERS);
    setOverlayText('');
    setTrimStart(0);
    setTrimEnd(0);
    setDuration(0);
  };

  const handleFile = useCallback((file: File) => {
    setMediaError(null);
    if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
      setMediaError('Format non pris en charge. Utilise MP4, WebM, MOV, JPEG, PNG ou WebP.');
      return;
    }
    if (file.size <= 0) {
      setMediaError('Le fichier sélectionné est vide.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMediaError('Le fichier dépasse la limite de 100 Mo.');
      return;
    }

    stopCamera();
    const url = URL.createObjectURL(file);
    setOwnedSource({
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      url,
      isObjectUrl: true,
    });
    resetEditing();
  }, [setOwnedSource, stopCamera]);

  const onPickFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    // Selecting the same file again must still fire onChange.
    event.target.value = '';
  }, [handleFile]);

  const startCamera = async () => {
    setMediaError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('Ce navigateur ne permet pas la capture caméra.');
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setOwnedSource({ kind: 'none' });
      setRecording(false);
      requestAnimationFrame(async () => {
        if (!liveVideoRef.current || streamRef.current !== stream) return;
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => undefined);
      });
    } catch {
      setMediaError("Caméra indisponible. Autorise l'accès ou importe un fichier.");
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setMediaError("L'enregistrement vidéo n'est pas disponible dans ce navigateur.");
      return;
    }

    setMediaError(null);
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = () => setMediaError("L'enregistrement caméra a échoué.");
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      stopCamera();
      if (!blob.size) {
        setMediaError("L'enregistrement est vide.");
        return;
      }
      const url = URL.createObjectURL(blob);
      setOwnedSource({ kind: 'video', url, isObjectUrl: true });
      resetEditing();
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const cancelCamera = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    stopCamera();
    setOwnedSource({ kind: 'none' });
  };

  const onLoadedVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextDuration = video.duration && Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(nextDuration);
    setTrimStart(0);
    setTrimEnd(nextDuration);
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (trimEnd > 0 && video.currentTime >= trimEnd) {
      video.currentTime = trimStart;
      void video.play().catch(() => undefined);
    }
  };

  const buildThumbnail = (): string => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 640;
      const context = canvas.getContext('2d');
      if (!context) return source.kind !== 'none' ? source.url : '';
      context.filter = filtersToCss(filters);
      if (source.kind === 'video' && videoRef.current) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      } else if (source.kind === 'image' && imageRef.current) {
        context.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
      }
      if (overlayText) {
        context.filter = 'none';
        context.font = 'bold 28px sans-serif';
        context.fillStyle = '#fff';
        context.textAlign = 'center';
        context.shadowColor = 'rgba(0,0,0,0.6)';
        context.shadowBlur = 6;
        context.fillText(overlayText.slice(0, 40), canvas.width / 2, canvas.height / 2);
      }
      return canvas.toDataURL('image/jpeg', 0.75);
    } catch {
      return source.kind !== 'none' ? source.url : '';
    }
  };

  const handleExport = () => {
    if (source.kind === 'none') return;
    onExport({
      type: source.kind,
      sourceUrl: source.url,
      thumbnailUrl: buildThumbnail() || source.url,
      overlayText,
      filters,
      trimStart,
      trimEnd: trimEnd || duration,
    });
  };

  const cssFilter = filtersToCss(filters);
  const hasSource = source.kind !== 'none';
  const liveActive = Boolean(streamRef.current);

  return (
    <div style={styles.root}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={onPickFile}
      />

      <div style={styles.stage}>
        {liveActive ? (
          <video ref={liveVideoRef} style={styles.media} muted playsInline />
        ) : source.kind === 'video' ? (
          <video
            ref={videoRef}
            src={source.url}
            style={{ ...styles.media, filter: cssFilter }}
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={onLoadedVideo}
            onTimeUpdate={onTimeUpdate}
          />
        ) : source.kind === 'image' ? (
          <img ref={imageRef} src={source.url} style={{ ...styles.media, filter: cssFilter }} alt="Aperçu du média" />
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.placeholderMark}>+</div>
            <div style={styles.placeholderText}>Importe un média ou utilise ta caméra</div>
            <div style={styles.placeholderMeta}>MP4 · WebM · MOV · JPEG · PNG · WebP · 100 Mo max.</div>
          </div>
        )}

        {overlayText.length > 0 && hasSource && !liveActive && (
          <div style={styles.overlayText}>{overlayText}</div>
        )}

        {liveActive && (
          <div style={styles.recRow}>
            {recording ? (
              <button type="button" style={styles.recStop} onClick={stopRecording}>Arrêter l'enregistrement</button>
            ) : (
              <button type="button" style={styles.recStart} onClick={startRecording}>Enregistrer</button>
            )}
            <button type="button" style={styles.recCancel} onClick={cancelCamera}>Annuler</button>
          </div>
        )}
      </div>

      <div style={styles.sourceRow}>
        <button type="button" style={styles.sourceBtnPrimary} onClick={() => fileInputRef.current?.click()}>Importer un fichier</button>
        <button type="button" style={styles.sourceBtn} onClick={() => void startCamera()}>Utiliser la caméra</button>
      </div>
      {mediaError && <div style={styles.error}>{mediaError}</div>}

      {hasSource && !liveActive && (
        <div style={styles.controls}>
          <div style={styles.sectionLabel}>Filtres</div>
          <div style={styles.presetRow}>
            {FILTER_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                style={{ ...styles.presetBtn, ...(filtersToCss(preset.filters) === cssFilter ? styles.presetActive : {}) }}
                onClick={() => setFilters(preset.filters)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <Slider label="Luminosité" value={filters.brightness} min={50} max={150}
            onChange={(value) => setFilters((current) => ({ ...current, brightness: value }))} />
          <Slider label="Contraste" value={filters.contrast} min={50} max={150}
            onChange={(value) => setFilters((current) => ({ ...current, contrast: value }))} />
          <Slider label="Saturation" value={filters.saturate} min={0} max={200}
            onChange={(value) => setFilters((current) => ({ ...current, saturate: value }))} />

          <div style={styles.sectionLabel}>Texte à l'écran</div>
          <input
            style={styles.textInput}
            placeholder="Ajoute un texte…"
            value={overlayText}
            maxLength={120}
            onChange={(event) => setOverlayText(event.target.value)}
          />

          {source.kind === 'video' && duration > 0 && (
            <>
              <div style={styles.sectionLabel}>Découpage ({trimStart.toFixed(1)}s → {(trimEnd || duration).toFixed(1)}s)</div>
              <Slider label="Début" value={trimStart} min={0} max={Math.max(0, duration)} step={0.1}
                onChange={(value) => setTrimStart(Math.min(value, (trimEnd || duration) - 0.2))} unit="s" />
              <Slider label="Fin" value={trimEnd || duration} min={0} max={duration} step={0.1}
                onChange={(value) => setTrimEnd(Math.max(value, trimStart + 0.2))} unit="s" />
            </>
          )}
        </div>
      )}

      {hasSource && !liveActive && (
        <button type="button" style={styles.exportBtn} onClick={handleExport}>
          {productMode ? 'Continuer vers la fiche produit' : 'Continuer'}
        </button>
      )}
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '%', onChange }) => (
  <div style={styles.sliderRow}>
    <div style={styles.sliderLabel}>{label}</div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      style={styles.slider}
    />
    <div style={styles.sliderValue}>{Math.round(value)}{unit}</div>
  </div>
);

const BRAND = '#FE2C55';
const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', color: '#fff' },
  stage: {
    position: 'relative',
    width: '100%',
    aspectRatio: '9 / 16',
    maxHeight: 420,
    background: '#070707',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #232323',
  },
  media: { width: '100%', height: '100%', objectFit: 'cover' },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#8A8B91', padding: 24, textAlign: 'center' },
  placeholderMark: { width: 48, height: 48, borderRadius: 24, display: 'grid', placeItems: 'center', background: '#181818', color: '#fff', fontSize: 30, fontWeight: 300 },
  placeholderText: { fontSize: 14, color: '#d5d5d5', fontWeight: 700 },
  placeholderMeta: { fontSize: 11, color: '#707070' },
  overlayText: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: 'translateY(-50%)',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 2px 8px rgba(0,0,0,0.7)',
    padding: '0 16px',
    pointerEvents: 'none',
  },
  recRow: { position: 'absolute', bottom: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10 },
  recStart: { background: BRAND, color: '#fff', border: 'none', borderRadius: 999, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' },
  recStop: { background: '#fff', color: '#000', border: 'none', borderRadius: 999, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' },
  recCancel: { background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 999, padding: '10px 16px', cursor: 'pointer' },
  sourceRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  sourceBtnPrimary: { flex: '1 0 180px', background: '#fff', color: '#080808', border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  sourceBtn: { flex: '1 0 160px', background: '#1E1E1E', color: '#fff', border: '1px solid #2A2A2A', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  error: { color: '#FF8397', background: '#2a1117', borderRadius: 9, padding: '9px 11px', fontSize: 12 },
  controls: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 4 },
  presetRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  presetBtn: { background: '#1E1E1E', color: '#cfcfcf', border: '1px solid #2A2A2A', borderRadius: 999, padding: '7px 14px', fontSize: 12, cursor: 'pointer' },
  presetActive: { background: BRAND, color: '#fff', borderColor: BRAND },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 10 },
  sliderLabel: { width: 86, fontSize: 12, color: '#8A8B91' },
  slider: { flex: 1, accentColor: BRAND },
  sliderValue: { width: 44, textAlign: 'right', fontSize: 12, color: '#fff' },
  textInput: { background: '#1E1E1E', color: '#fff', border: '1px solid #2A2A2A', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' },
  exportBtn: { background: BRAND, color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
};

export default WebMediaEditor;
