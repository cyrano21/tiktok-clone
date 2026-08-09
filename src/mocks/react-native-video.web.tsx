import React, { useEffect, useImperativeHandle, useRef } from 'react';

interface VideoSource {
  uri?: string;
}

interface VideoProps {
  source?: VideoSource;
  style?: any;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'none';
  paused?: boolean;
  repeat?: boolean;
  muted?: boolean;
  rate?: number;
  playInBackground?: boolean;
  playWhenInactive?: boolean;
  onLoad?: (data: { duration: number; naturalSize?: { width: number; height: number; orientation: 'portrait' | 'landscape' } }) => void;
  onProgress?: (data: { currentTime: number; playableDuration: number; seekableDuration: number }) => void;
  onBuffer?: (data: { isBuffering: boolean }) => void;
  onError?: (e: unknown) => void;
  onEnd?: () => void;
}

export interface VideoRef {
  seek: (time: number) => void;
  presentFullscreenPlayer: () => void;
  dismissFullscreenPlayer: () => void;
}

const flattenStyle = (style: any): React.CSSProperties => {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
  }
  return style as React.CSSProperties;
};

const Video = React.forwardRef<VideoRef, VideoProps>((props, ref) => {
  const {
    source,
    style,
    resizeMode = 'cover',
    paused = false,
    repeat = false,
    muted = false,
    rate = 1,
    onLoad,
    onProgress,
    onBuffer,
    onError,
    onEnd,
  } = props;

  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    seek: (time: number) => {
      if (videoRef.current) videoRef.current.currentTime = time;
    },
    presentFullscreenPlayer: () => {
      videoRef.current?.requestFullscreen?.();
    },
    dismissFullscreenPlayer: () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
    },
  }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) {
      v.pause();
    } else {
      // Respect the caller's muted intent; browsers may still block unmuted
      // autoplay before any user gesture, in which case we fall back to muted.
      v.muted = muted;
      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
      }
    }
  }, [paused, source?.uri, muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (v && Number.isFinite(rate) && rate > 0) v.playbackRate = rate;
  }, [rate]);

  const cssStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: resizeMode === 'cover' ? 'cover' : resizeMode === 'contain' ? 'contain' : 'fill',
    backgroundColor: '#000',
    ...flattenStyle(style),
  };

  return (
    <video
      ref={videoRef}
      src={source?.uri}
      loop={repeat}
      muted={muted}
      autoPlay={!paused}
      playsInline
      preload="auto"
      style={cssStyle}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        onLoad?.({
          duration: v.duration || 0,
          naturalSize: {
            width: v.videoWidth,
            height: v.videoHeight,
            orientation: v.videoHeight >= v.videoWidth ? 'portrait' : 'landscape',
          },
        });
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        onProgress?.({
          currentTime: v.currentTime,
          playableDuration: v.duration,
          seekableDuration: v.duration,
        });
      }}
      onWaiting={() => onBuffer?.({ isBuffering: true })}
      onPlaying={() => onBuffer?.({ isBuffering: false })}
      onCanPlay={() => onBuffer?.({ isBuffering: false })}
      onError={(e) => onError?.(e)}
      onEnded={() => onEnd?.()}
    />
  );
});

Video.displayName = 'Video';

export default Video;
export { Video };

export type OnLoadData = { duration: number };
export type OnProgressData = { currentTime: number; playableDuration: number };
export type OnBufferData = { isBuffering: boolean };
