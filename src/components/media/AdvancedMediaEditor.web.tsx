import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_FILTERS, filtersToCss, MediaFilters, MediaType } from '@/store/studioStore';
import { WebMediaEditor, type EditorResult } from './WebMediaEditor';
import type {
  AdvancedEditorResult,
  TimelineCompositionClip,
  TimelineTransition,
} from './AdvancedMediaEditor.types';

interface Props {
  onExport: (result: AdvancedEditorResult) => void;
  productMode?: boolean;
}

type SourceAsset = {
  id: string;
  fieldName: string;
  blob: Blob;
  filename: string;
  mimetype: string;
  kind: MediaType;
  url: string;
  duration: number;
};

type ClipDraft = TimelineCompositionClip & { sourceId: string };

const ALLOWED_MEDIA_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_SOURCES = 8;
const MAX_CLIPS = 20;
const MAX_TIMELINE_SECONDS = 10 * 60;

const FILTER_PRESETS: { id: string; label: string; filters: MediaFilters }[] = [
  { id: 'none', label: 'Original', filters: DEFAULT_FILTERS },
  { id: 'vivid', label: 'Vif', filters: { brightness: 108, contrast: 118, saturate: 150, sepia: 0, grayscale: 0 } },
  { id: 'mono', label: 'N&B', filters: { brightness: 105, contrast: 110, saturate: 0, sepia: 0, grayscale: 100 } },
  { id: 'warm', label: 'Chaud', filters: { brightness: 105, contrast: 105, saturate: 120, sepia: 35, grayscale: 0 } },
  { id: 'cool', label: 'Froid', filters: { brightness: 100, contrast: 110, saturate: 90, sepia: 0, grayscale: 10 } },
];

function clipDuration(clip: ClipDraft) {
  return clip.kind === 'image'
    ? Math.max(1, clip.imageDuration || 5)
    : Math.max(0, clip.trimEnd - clip.trimStart);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.removeAttribute('src');
      video.load();
      resolve(duration);
    };
    video.onerror = () => reject(new Error('Métadonnées vidéo illisibles.'));
    video.src = url;
  });
}

function toSingleResult(result: EditorResult): AdvancedEditorResult {
  return { mode: 'single', ...result };
}

export const AdvancedMediaEditor: React.FC<Props> = ({ onExport, productMode }) => {
  const [mode, setMode] = useState<'timeline' | 'quick'>('timeline');
  const [sources, setSources] = useState<SourceAsset[]>([]);
  const [clips, setClips] = useState<ClipDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sourceCounter = useRef(0);
  const sourcesRef = useRef<SourceAsset[]>([]);

  useEffect(() => { sourcesRef.current = sources; }, [sources]);
  useEffect(() => () => {
    sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.url));
  }, []);

  const selectedIndex = clips.findIndex((clip) => clip.id === selectedId);
  const selected = selectedIndex >= 0 ? clips[selectedIndex] : null;
  const selectedSource = selected ? sources.find((source) => source.id === selected.sourceId) ?? null : null;
  const totalDuration = useMemo(() => clips.reduce((sum, clip) => sum + clipDuration(clip), 0), [clips]);

  const updateClip = useCallback((id: string, update: Partial<ClipDraft>) => {
    setClips((current) => current.map((clip) => clip.id === id ? { ...clip, ...update } : clip));
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    if (sources.length + files.length > MAX_SOURCES) {
      setError(`La timeline accepte ${MAX_SOURCES} sources maximum par montage.`);
      return;
    }
    if (clips.length + files.length > MAX_CLIPS) {
      setError(`La timeline accepte ${MAX_CLIPS} clips maximum.`);
      return;
    }

    setLoadingFiles(true);
    const createdSources: SourceAsset[] = [];
    const createdClips: ClipDraft[] = [];
    try {
      for (const file of files) {
        if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
          throw new Error(`${file.name}: format non pris en charge.`);
        }
        if (!file.size || file.size > MAX_SOURCE_BYTES) {
          throw new Error(`${file.name}: chaque source doit faire entre 1 octet et 100 Mo.`);
        }
        const kind: MediaType = file.type.startsWith('video/') ? 'video' : 'image';
        const url = URL.createObjectURL(file);
        let duration = 5;
        try {
          if (kind === 'video') duration = await readVideoDuration(url);
          if (kind === 'video' && (!duration || duration <= 0)) throw new Error('durée invalide');
        } catch {
          URL.revokeObjectURL(url);
          throw new Error(`${file.name}: impossible de lire la durée de la vidéo.`);
        }

        const fieldName = `source_${sourceCounter.current++}`;
        const source: SourceAsset = {
          id: makeId('source'),
          fieldName,
          blob: file,
          filename: file.name || `${fieldName}.${kind === 'video' ? 'mp4' : 'jpg'}`,
          mimetype: file.type,
          kind,
          url,
          duration,
        };
        const clip: ClipDraft = {
          id: makeId('clip'),
          sourceId: source.id,
          sourceField: source.fieldName,
          kind,
          trimStart: 0,
          trimEnd: kind === 'video' ? duration : 0,
          imageDuration: kind === 'image' ? 5 : 0,
          overlayText: '',
          filters: { ...DEFAULT_FILTERS },
          transition: 'none',
        };
        createdSources.push(source);
        createdClips.push(clip);
      }

      setSources((current) => [...current, ...createdSources]);
      setClips((current) => [...current, ...createdClips]);
      setSelectedId((current) => current ?? createdClips[0]?.id ?? null);
    } catch (cause) {
      createdSources.forEach((source) => URL.revokeObjectURL(source.url));
      setError(cause instanceof Error ? cause.message : 'Import impossible.');
    } finally {
      setLoadingFiles(false);
    }
  }, [clips.length, sources.length]);

  const onPickFiles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    void addFiles(selectedFiles);
  }, [addFiles]);

  const removeClip = useCallback((clipId: string) => {
    const removed = clips.find((clip) => clip.id === clipId);
    if (!removed) return;
    const remaining = clips.filter((clip) => clip.id !== clipId);
    setClips(remaining);
    if (selectedId === clipId) setSelectedId(remaining[0]?.id ?? null);

    const sourceStillUsed = remaining.some((clip) => clip.sourceId === removed.sourceId);
    if (!sourceStillUsed) {
      const source = sources.find((item) => item.id === removed.sourceId);
      if (source) URL.revokeObjectURL(source.url);
      setSources((current) => current.filter((item) => item.id !== removed.sourceId));
    }
  }, [clips, selectedId, sources]);

  const moveClip = useCallback((clipId: string, direction: -1 | 1) => {
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === clipId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }, []);

  const splitSelected = useCallback(() => {
    if (!selected || selected.kind !== 'video' || clips.length >= MAX_CLIPS) return;
    const fallback = selected.trimStart + (selected.trimEnd - selected.trimStart) / 2;
    const currentTime = videoRef.current?.currentTime ?? fallback;
    const splitAt = Math.min(selected.trimEnd - 0.2, Math.max(selected.trimStart + 0.2, currentTime));
    if (splitAt <= selected.trimStart + 0.19 || splitAt >= selected.trimEnd - 0.19) {
      setError('Place la lecture au milieu du clip avant de le scinder.');
      return;
    }
    const right: ClipDraft = {
      ...selected,
      id: makeId('clip'),
      trimStart: splitAt,
    };
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === selected.id);
      if (index < 0) return current;
      const next = [...current];
      next[index] = { ...selected, trimEnd: splitAt };
      next.splice(index + 1, 0, right);
      return next;
    });
    setSelectedId(right.id);
    setError(null);
  }, [clips.length, selected]);

  const onVideoLoaded = useCallback(() => {
    if (!videoRef.current || !selected) return;
    videoRef.current.currentTime = selected.trimStart;
  }, [selected]);

  const onVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !selected || selected.kind !== 'video') return;
    if (video.currentTime >= selected.trimEnd) {
      video.currentTime = selected.trimStart;
      void video.play().catch(() => undefined);
    }
  }, [selected]);

  const exportTimeline = useCallback(() => {
    setError(null);
    if (!clips.length) {
      setError('Ajoute au moins un média à la timeline.');
      return;
    }
    if (totalDuration <= 0 || totalDuration > MAX_TIMELINE_SECONDS) {
      setError('Le montage final doit durer entre 0 et 10 minutes.');
      return;
    }
    const referencedSourceIds = new Set(clips.map((clip) => clip.sourceId));
    const usedSources = sources.filter((source) => referencedSourceIds.has(source.id));
    if (!usedSources.length) {
      setError('Les sources de la timeline sont introuvables.');
      return;
    }

    onExport({
      mode: 'timeline',
      type: 'video',
      sourceUrl: usedSources[0].url,
      thumbnailUrl: usedSources[0].url,
      overlayText: '',
      filters: { ...DEFAULT_FILTERS },
      trimStart: 0,
      trimEnd: totalDuration,
      totalDuration,
      assets: usedSources.map((source) => ({
        fieldName: source.fieldName,
        blob: source.blob,
        filename: source.filename,
        mimetype: source.mimetype,
      })),
      composition: {
        version: 1,
        clips: clips.map(({ sourceId: _sourceId, ...clip }) => clip),
      },
    });
  }, [clips, onExport, sources, totalDuration]);

  if (mode === 'quick') {
    return (
      <div style={styles.root}>
        <div style={styles.modeRow}>
          <button type="button" style={styles.modeButton} onClick={() => setMode('timeline')}>Timeline avancée</button>
          <button type="button" style={{ ...styles.modeButton, ...styles.modeActive }}>Mode rapide</button>
        </div>
        <WebMediaEditor productMode={productMode} onExport={(result) => onExport(toSingleResult(result))} />
      </div>
    );
  }

  const cssFilter = filtersToCss(selected?.filters ?? DEFAULT_FILTERS);

  return (
    <div style={styles.root}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={onPickFiles}
      />

      <div style={styles.modeRow}>
        <button type="button" style={{ ...styles.modeButton, ...styles.modeActive }}>Timeline avancée</button>
        <button type="button" style={styles.modeButton} onClick={() => setMode('quick')}>Mode rapide / caméra</button>
      </div>

      <div style={styles.infoBar}>
        <div><strong>Studio Timeline</strong><span style={styles.infoText}> · plusieurs clips, split, ordre, filtres, texte et fondus.</span></div>
        <div style={styles.durationBadge}>{totalDuration.toFixed(1)} s</div>
      </div>

      <div style={styles.stage}>
        {!selected || !selectedSource ? (
          <div style={styles.emptyStage}>
            <div style={styles.emptyMark}>＋</div>
            <div style={styles.emptyTitle}>Construis ton montage</div>
            <div style={styles.emptyText}>Importe jusqu’à 8 sources. Une même source peut être scindée en plusieurs clips sans être réimportée.</div>
          </div>
        ) : selected.kind === 'video' ? (
          <video
            key={`${selected.id}-${selected.trimStart}`}
            ref={videoRef}
            src={selectedSource.url}
            style={{ ...styles.previewMedia, filter: cssFilter }}
            controls
            muted
            playsInline
            onLoadedMetadata={onVideoLoaded}
            onTimeUpdate={onVideoTimeUpdate}
          />
        ) : (
          <img src={selectedSource.url} alt="Aperçu" style={{ ...styles.previewMedia, filter: cssFilter }} />
        )}
        {selected?.overlayText ? <div style={styles.overlay}>{selected.overlayText}</div> : null}
      </div>

      <div style={styles.actionRow}>
        <button type="button" style={styles.primaryButton} disabled={loadingFiles} onClick={() => fileInputRef.current?.click()}>
          {loadingFiles ? 'Lecture des médias…' : 'Ajouter des médias'}
        </button>
        {selected?.kind === 'video' ? <button type="button" style={styles.secondaryButton} onClick={splitSelected}>Scinder au curseur</button> : null}
      </div>
      {error ? <div style={styles.error}>{error}</div> : null}

      {clips.length > 0 ? (
        <>
          <div style={styles.sectionHeader}>
            <span>Timeline</span>
            <span style={styles.muted}>{clips.length} clip{clips.length > 1 ? 's' : ''}</span>
          </div>
          <div style={styles.timeline}>
            {clips.map((clip, index) => {
              const source = sources.find((item) => item.id === clip.sourceId);
              const active = clip.id === selectedId;
              const duration = clipDuration(clip);
              return (
                <button
                  type="button"
                  key={clip.id}
                  style={{
                    ...styles.clipCard,
                    ...(active ? styles.clipActive : {}),
                    width: Math.max(118, Math.min(250, duration * 16)),
                  }}
                  onClick={() => setSelectedId(clip.id)}
                >
                  <span style={styles.clipIndex}>{index + 1}</span>
                  <span style={styles.clipName}>{source?.filename ?? 'Source'}</span>
                  <span style={styles.clipMeta}>{duration.toFixed(1)} s · {clip.kind === 'video' ? 'vidéo' : 'image'}</span>
                  {clip.transition === 'fade' ? <span style={styles.clipTag}>fondu</span> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {selected && selectedSource ? (
        <div style={styles.inspector}>
          <div style={styles.inspectorHeader}>
            <div>
              <div style={styles.inspectorTitle}>Clip sélectionné</div>
              <div style={styles.muted}>{selectedSource.filename}</div>
            </div>
            <div style={styles.smallActions}>
              <button type="button" style={styles.iconButton} disabled={selectedIndex <= 0} onClick={() => moveClip(selected.id, -1)}>←</button>
              <button type="button" style={styles.iconButton} disabled={selectedIndex >= clips.length - 1} onClick={() => moveClip(selected.id, 1)}>→</button>
              <button type="button" style={styles.dangerButton} onClick={() => removeClip(selected.id)}>Supprimer</button>
            </div>
          </div>

          {selected.kind === 'video' ? (
            <div style={styles.controlGroup}>
              <RangeControl
                label={`Début · ${selected.trimStart.toFixed(1)} s`}
                value={selected.trimStart}
                min={0}
                max={Math.max(0, selected.trimEnd - 0.2)}
                step={0.1}
                onChange={(value) => updateClip(selected.id, { trimStart: Math.min(value, selected.trimEnd - 0.2) })}
              />
              <RangeControl
                label={`Fin · ${selected.trimEnd.toFixed(1)} s`}
                value={selected.trimEnd}
                min={Math.min(selectedSource.duration, selected.trimStart + 0.2)}
                max={selectedSource.duration}
                step={0.1}
                onChange={(value) => updateClip(selected.id, { trimEnd: Math.max(value, selected.trimStart + 0.2) })}
              />
            </div>
          ) : (
            <RangeControl
              label={`Durée image · ${selected.imageDuration.toFixed(1)} s`}
              value={selected.imageDuration}
              min={1}
              max={15}
              step={0.5}
              onChange={(value) => updateClip(selected.id, { imageDuration: value })}
            />
          )}

          <div style={styles.sectionLabel}>Transition</div>
          <div style={styles.presetRow}>
            {(['none', 'fade'] as TimelineTransition[]).map((transition) => (
              <button
                type="button"
                key={transition}
                style={{ ...styles.presetButton, ...(selected.transition === transition ? styles.presetActive : {}) }}
                onClick={() => updateClip(selected.id, { transition })}
              >
                {transition === 'none' ? 'Coupe franche' : 'Fondu'}
              </button>
            ))}
          </div>

          <div style={styles.sectionLabel}>Filtres</div>
          <div style={styles.presetRow}>
            {FILTER_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                style={{ ...styles.presetButton, ...(filtersToCss(preset.filters) === cssFilter ? styles.presetActive : {}) }}
                onClick={() => updateClip(selected.id, { filters: { ...preset.filters } })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <RangeControl label="Luminosité" value={selected.filters.brightness} min={50} max={150}
            onChange={(value) => updateClip(selected.id, { filters: { ...selected.filters, brightness: value } })} />
          <RangeControl label="Contraste" value={selected.filters.contrast} min={50} max={150}
            onChange={(value) => updateClip(selected.id, { filters: { ...selected.filters, contrast: value } })} />
          <RangeControl label="Saturation" value={selected.filters.saturate} min={0} max={200}
            onChange={(value) => updateClip(selected.id, { filters: { ...selected.filters, saturate: value } })} />

          <div style={styles.sectionLabel}>Texte du clip</div>
          <input
            style={styles.textInput}
            value={selected.overlayText}
            maxLength={120}
            placeholder="Hook, CTA, bénéfice produit…"
            onChange={(event) => updateClip(selected.id, { overlayText: event.target.value })}
          />
        </div>
      ) : null}

      {clips.length ? (
        <button type="button" style={styles.exportButton} onClick={exportTimeline}>
          {productMode ? 'Continuer vers la vidéo produit' : 'Continuer avec ce montage'}
        </button>
      ) : null}
      <div style={styles.footerNote}>Le rendu final est fait côté serveur par FFmpeg : les fichiers locaux ne sont pas considérés comme publiés tant que le serveur n’a pas confirmé le MP4 final.</div>
    </div>
  );
};

const RangeControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <label style={styles.rangeRow}>
    <span style={styles.rangeLabel}>{label}</span>
    <input
      type="range"
      value={Number.isFinite(value) ? value : min}
      min={min}
      max={Math.max(min, max)}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      style={styles.rangeInput}
    />
  </label>
);

const styles: Record<string, React.CSSProperties> = {
  root: { width: '100%', display: 'flex', flexDirection: 'column', gap: 14, color: '#fff' },
  modeRow: { display: 'flex', gap: 8, padding: 4, background: '#13131c', borderRadius: 12, alignSelf: 'flex-start' },
  modeButton: { border: 0, background: 'transparent', color: '#9a9aaa', borderRadius: 9, padding: '9px 13px', cursor: 'pointer', fontWeight: 700 },
  modeActive: { background: '#2c2152', color: '#fff' },
  infoBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#171329', borderRadius: 14, padding: '12px 14px' },
  infoText: { color: '#a7a2b7', fontSize: 13 },
  durationBadge: { whiteSpace: 'nowrap', background: '#251f3f', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 800 },
  stage: { position: 'relative', width: '100%', maxWidth: 470, aspectRatio: '9 / 16', margin: '0 auto', borderRadius: 18, overflow: 'hidden', background: '#09090f', boxShadow: '0 18px 60px rgba(0,0,0,.28)' },
  previewMedia: { width: '100%', height: '100%', objectFit: 'contain', background: '#09090f' },
  emptyStage: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 9, padding: 34 },
  emptyMark: { width: 58, height: 58, borderRadius: 18, background: '#22183f', display: 'grid', placeItems: 'center', fontSize: 30 },
  emptyTitle: { fontWeight: 900, fontSize: 20 },
  emptyText: { color: '#9993aa', fontSize: 13, lineHeight: 1.5, maxWidth: 330 },
  overlay: { position: 'absolute', left: '8%', right: '8%', top: '47%', textAlign: 'center', fontSize: 'clamp(18px, 4vw, 34px)', fontWeight: 900, textShadow: '0 2px 12px rgba(0,0,0,.9)', pointerEvents: 'none', whiteSpace: 'pre-wrap' },
  actionRow: { display: 'flex', flexWrap: 'wrap', gap: 9 },
  primaryButton: { border: 0, borderRadius: 11, padding: '11px 15px', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 800 },
  secondaryButton: { border: '1px solid #40385d', borderRadius: 11, padding: '10px 14px', background: '#181624', color: '#fff', cursor: 'pointer', fontWeight: 700 },
  error: { background: '#321a20', color: '#ff8d9b', borderRadius: 10, padding: '10px 12px', fontSize: 13 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800 },
  muted: { color: '#928da1', fontSize: 12 },
  timeline: { display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 2px 10px' },
  clipCard: { position: 'relative', minWidth: 118, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left', border: '1px solid #2c2938', background: '#14131b', color: '#fff', borderRadius: 12, padding: '11px 12px', cursor: 'pointer', overflow: 'hidden' },
  clipActive: { border: '1px solid #8b5cf6', background: '#211936', boxShadow: '0 0 0 2px rgba(139,92,246,.12)' },
  clipIndex: { width: 22, height: 22, borderRadius: 7, background: '#2a2440', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 },
  clipName: { width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800, fontSize: 12 },
  clipMeta: { color: '#9993aa', fontSize: 11 },
  clipTag: { color: '#d7c7ff', background: '#35245a', borderRadius: 999, padding: '3px 7px', fontSize: 10, fontWeight: 800 },
  inspector: { display: 'flex', flexDirection: 'column', gap: 12, background: '#121119', borderRadius: 14, padding: 14 },
  inspectorHeader: { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  inspectorTitle: { fontWeight: 900 },
  smallActions: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  iconButton: { minWidth: 34, height: 34, border: '1px solid #34303f', background: '#1a1821', color: '#fff', borderRadius: 9, cursor: 'pointer' },
  dangerButton: { height: 34, border: 0, background: '#351820', color: '#ff93a1', borderRadius: 9, padding: '0 10px', cursor: 'pointer', fontWeight: 700 },
  controlGroup: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 },
  sectionLabel: { fontSize: 12, color: '#c5c0d2', fontWeight: 800, marginTop: 2 },
  presetRow: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  presetButton: { border: '1px solid #353142', background: '#191720', color: '#a9a4b4', borderRadius: 999, padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  presetActive: { border: '1px solid #8b5cf6', color: '#fff', background: '#2a1d48' },
  rangeRow: { display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'center' },
  rangeLabel: { color: '#a9a4b4', fontSize: 12 },
  rangeInput: { width: '100%', accentColor: '#8b5cf6' },
  textInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #353142', background: '#0e0d13', color: '#fff', borderRadius: 10, padding: '11px 12px', outline: 'none' },
  exportButton: { border: 0, borderRadius: 12, padding: '14px 18px', background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontWeight: 900, cursor: 'pointer', fontSize: 14 },
  footerNote: { color: '#7f7a8b', fontSize: 11, lineHeight: 1.5 },
};

export default AdvancedMediaEditor;
