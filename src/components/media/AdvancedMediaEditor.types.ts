import type { MediaFilters, MediaType } from '@/store/studioStore';

export type TimelineTransition = 'none' | 'fade';

export interface TimelineCompositionClip {
  id: string;
  sourceField: string;
  kind: MediaType;
  trimStart: number;
  trimEnd: number;
  imageDuration: number;
  overlayText: string;
  filters: MediaFilters;
  transition: TimelineTransition;
}

export interface TimelineCompositionManifest {
  version: 1;
  clips: TimelineCompositionClip[];
}

export interface TimelineSourceAsset {
  fieldName: string;
  blob: Blob;
  filename: string;
  mimetype: string;
}

export interface SingleEditorResult {
  mode: 'single';
  type: MediaType;
  sourceUrl: string;
  thumbnailUrl: string;
  overlayText: string;
  filters: MediaFilters;
  trimStart: number;
  trimEnd: number;
}

export interface TimelineEditorResult {
  mode: 'timeline';
  type: 'video';
  sourceUrl: string;
  thumbnailUrl: string;
  overlayText: string;
  filters: MediaFilters;
  trimStart: number;
  trimEnd: number;
  totalDuration: number;
  assets: TimelineSourceAsset[];
  composition: TimelineCompositionManifest;
}

export type AdvancedEditorResult = SingleEditorResult | TimelineEditorResult;
