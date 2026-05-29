import React from 'react';
import type { TikTokEmbedProps } from './TikTokEmbed';

/**
 * Web embed of a real TikTok video using the official `embed_link` iframe.
 * This is the genuine TikTok player (no scraping, no re-hosting) — exactly what
 * the Display API expects consumers to use for `video.list` items.
 *
 * If no embed link is available, falls back to a thumbnail + open-on-TikTok CTA.
 */
export const TikTokEmbed: React.FC<TikTokEmbedProps> = ({
  embedLink,
  shareUrl,
  height = 580,
}) => {
  if (embedLink) {
    return (
      <div style={{ ...S.frameWrap, height }}>
        <iframe
          src={embedLink}
          title="TikTok video"
          style={S.iframe}
          allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a href={shareUrl ?? '#'} target="_blank" rel="noopener noreferrer" style={S.fallback}>
      <span style={S.fallbackIcon}>▶</span>
      <span style={S.fallbackText}>Ouvrir sur TikTok</span>
    </a>
  );
};

const S: Record<string, React.CSSProperties> = {
  frameWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
  },
  iframe: { width: '100%', height: '100%', border: 'none' },
  fallback: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
    background: '#161616',
    borderRadius: 12,
    color: '#fff',
    textDecoration: 'none',
  },
  fallbackIcon: { fontSize: 28 },
  fallbackText: { fontSize: 14, color: '#8A8B91' },
};

export default TikTokEmbed;
