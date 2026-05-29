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

const SAMPLE_VIDEO = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4';
const SAMPLE_IMAGE = 'https://picsum.photos/seed/editorsample/720/1280';

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
  const [camError, setCamError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Clean up object URLs and camera on unmount
  useEffect(() => {
    return () => {
      if (source.kind !== 'none' && source.isObjectUrl) URL.revokeObjectURL(source.url);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video')) {
      setSource({ kind: 'video', url, isObjectUrl: true });
    } else {
      setSource({ kind: 'image', url, isObjectUrl: true });
    }
    setFilters(DEFAULT_FILTERS);
    setOverlayText('');
    setTrimStart(0);
    setTrimEnd(0);
  }, []);

  const onPickFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const useSample = (type: MediaType) => {
    setSource(type === 'video'
      ? { kind: 'video', url: SAMPLE_VIDEO, isObjectUrl: false }
      : { kind: 'image', url: SAMPLE_IMAGE, isObjectUrl: false });
    setFilters(DEFAULT_FILTERS);
    setOverlayText('');
  };

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play().catch(() => {});
      }
      setSource({ kind: 'none' });
      setRecording(false);
    } catch (err) {
      setCamError("Caméra indisponible. Autorise l'accès ou importe un fichier.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      stopCamera();
      setSource({ kind: 'video', url, isObjectUrl: true });
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const onLoadedVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration && isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(d);
  };

  // keep playback inside trim window
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (trimEnd > 0 && v.currentTime >= trimEnd) {
      v.currentTime = trimStart;
      v.play().catch(() => {});
    }
  };

  const buildThumbnail = (): string => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) return source.kind !== 'none' ? source.url : '';
      ctx.filter = filtersToCss(filters);
      if (source.kind === 'video' && videoRef.current) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      } else if (source.kind === 'image' && imageRef.current) {
        ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
      }
      if (overlayText) {
        ctx.filter = 'none';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(overlayText.slice(0, 24), canvas.width / 2, canvas.height / 2);
      }
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      // cross-origin sample taints canvas → fall back to source url
      return source.kind !== 'none' ? source.url : '';
    }
  };

  const handleExport = () => {
    if (source.kind === 'none') return;
    const thumb = buildThumbnail();
    onExport({
      type: source.kind,
      sourceUrl: source.url,
      thumbnailUrl: thumb || source.url,
      overlayText,
      filters,
      trimStart,
      trimEnd: trimEnd || duration,
    });
  };

  const cssFilter = filtersToCss(filters);
  const hasSource = source.kind !== 'none';
  const liveActive = !!streamRef.current;

  return (
    <div style={S.root}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={onPickFile}
      />

      {/* Preview stage */}
      <div style={S.stage}>
        {liveActive ? (
          <video ref={liveVideoRef} style={S.media} muted playsInline />
        ) : source.kind === 'video' ? (
          <video
            ref={videoRef}
            src={source.url}
            style={{ ...S.media, filter: cssFilter }}
            autoPlay
            loop
            muted
            playsInline
            onLoadedMetadata={onLoadedVideo}
            onTimeUpdate={onTimeUpdate}
          />
        ) : source.kind === 'image' ? (
          <img ref={imageRef} src={source.url} style={{ ...S.media, filter: cssFilter }} crossOrigin="anonymous" alt="preview" />
        ) : (
          <div style={S.placeholder}>
            <div style={{ fontSize: 46 }}>🎬</div>
            <div style={S.placeholderText}>Choisis une source pour commencer</div>
          </div>
        )}

        {overlayText.length > 0 && hasSource && !liveActive && (
          <div style={S.overlayText}>{overlayText}</div>
        )}

        {liveActive && (
          <div style={S.recRow}>
            {recording ? (
              <button style={S.recStop} onClick={stopRecording}>■ Arrêter</button>
            ) : (
              <button style={S.recStart} onClick={startRecording}>● Enregistrer</button>
            )}
            <button style={S.recCancel} onClick={() => { stopRecording(); stopCamera(); setSource({ kind: 'none' }); }}>Annuler</button>
          </div>
        )}
      </div>

      {/* Source buttons */}
      <div style={S.sourceRow}>
        <button style={S.sourceBtn} onClick={() => fileInputRef.current?.click()}>📁 Importer</button>
        <button style={S.sourceBtn} onClick={startCamera}>🎥 Caméra</button>
        <button style={S.sourceBtn} onClick={() => useSample('video')}>🎞️ Vidéo démo</button>
        <button style={S.sourceBtn} onClick={() => useSample('image')}>🖼️ Image démo</button>
      </div>
      {camError && <div style={S.error}>{camError}</div>}

      {/* Editing controls */}
      {hasSource && !liveActive && (
        <div style={S.controls}>
          {/* Presets */}
          <div style={S.sectionLabel}>Filtres</div>
          <div style={S.presetRow}>
            {FILTER_PRESETS.map((p) => (
              <button
                key={p.id}
                style={{ ...S.presetBtn, ...(filtersToCss(p.filters) === cssFilter ? S.presetActive : {}) }}
                onClick={() => setFilters(p.filters)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual sliders */}
          <Slider label="Luminosité" value={filters.brightness} min={50} max={150}
            onChange={(v) => setFilters((f) => ({ ...f, brightness: v }))} />
          <Slider label="Contraste" value={filters.contrast} min={50} max={150}
            onChange={(v) => setFilters((f) => ({ ...f, contrast: v }))} />
          <Slider label="Saturation" value={filters.saturate} min={0} max={200}
            onChange={(v) => setFilters((f) => ({ ...f, saturate: v }))} />

          {/* Text overlay */}
          <div style={S.sectionLabel}>Texte à l'écran</div>
          <input
            style={S.textInput}
            placeholder="Ajoute un texte…"
            value={overlayText}
            maxLength={40}
            onChange={(e) => setOverlayText(e.target.value)}
          />

          {/* Trim (video only) */}
          {source.kind === 'video' && duration > 0 && (
            <>
              <div style={S.sectionLabel}>Découpage ({trimStart.toFixed(1)}s → {(trimEnd || duration).toFixed(1)}s)</div>
              <Slider label="Début" value={trimStart} min={0} max={Math.max(0, duration)} step={0.1}
                onChange={(v) => setTrimStart(Math.min(v, (trimEnd || duration) - 0.2))} unit="s" />
              <Slider label="Fin" value={trimEnd || duration} min={0} max={duration} step={0.1}
                onChange={(v) => setTrimEnd(Math.max(v, trimStart + 0.2))} unit="s" />
            </>
          )}
        </div>
      )}

      {/* Export */}
      {hasSource && !liveActive && (
        <button style={S.exportBtn} onClick={handleExport}>
          {productMode ? 'Continuer vers la fiche produit →' : 'Continuer →'}
        </button>
      )}
    </div>
  );
};

const Slider: React.FC<{
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '%', onChange }) => (
  <div style={S.sliderRow}>
    <div style={S.sliderLabel}>{label}</div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={S.slider}
    />
    <div style={S.sliderValue}>{Math.round(value)}{unit}</div>
  </div>
);

const BRAND = '#FE2C55';
const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 12, width: '100%', color: '#fff' },
  stage: {
    position: 'relative',
    width: '100%',
    aspectRatio: '9 / 16',
    maxHeight: 420,
    background: '#000',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: { width: '100%', height: '100%', objectFit: 'cover' },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#8A8B91' },
  placeholderText: { fontSize: 14 },
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
  recCancel: { background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 16px', cursor: 'pointer' },
  sourceRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  sourceBtn: {
    flex: '1 0 auto',
    background: '#1E1E1E',
    color: '#fff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#2A2A2A',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: { color: '#FF6B81', fontSize: 13 },
  controls: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 4 },
  presetRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  presetBtn: {
    background: '#1E1E1E',
    color: '#cfcfcf',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#2A2A2A',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 12,
    cursor: 'pointer',
  },
  presetActive: { background: BRAND, color: '#fff', borderColor: BRAND },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 10 },
  sliderLabel: { width: 86, fontSize: 12, color: '#8A8B91' },
  slider: { flex: 1, accentColor: BRAND },
  sliderValue: { width: 44, textAlign: 'right', fontSize: 12, color: '#fff' },
  textInput: {
    background: '#1E1E1E',
    color: '#fff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#2A2A2A',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
  },
  exportBtn: {
    background: BRAND,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
};

export default WebMediaEditor;
