// Real-world publish helper.
//
// Direct programmatic upload to TikTok requires the official Content Posting API,
// which needs an approved developer app + user OAuth — not available client-side here.
// The honest, working approach: open TikTok's real upload page and put the caption
// (with hashtags) on the clipboard so the creator just pastes it.

const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/upload?lang=fr';
const TIKTOK_UPLOAD_FALLBACK = 'https://www.tiktok.com/upload';

export interface PublishPayload {
  caption: string;
  hashtags?: string[];
}

export function buildCaption({ caption, hashtags = [] }: PublishPayload): string {
  const tags = hashtags
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ');
  return [caption.trim(), tags].filter(Boolean).join('\n\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  // Legacy fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function openTikTokUpload(): void {
  if (typeof window === 'undefined') return;
  const win = window.open(TIKTOK_UPLOAD_URL, '_blank', 'noopener,noreferrer');
  if (!win) {
    // popup blocked → navigate fallback
    try {
      window.location.assign(TIKTOK_UPLOAD_FALLBACK);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Best-effort: download the edited media so the user can pick the file on TikTok.
 * Object URLs (uploads / webcam captures) can be downloaded directly.
 */
export function downloadMedia(sourceUrl: string, filename: string): void {
  if (typeof document === 'undefined' || !sourceUrl) return;
  try {
    const a = document.createElement('a');
    a.href = sourceUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    /* ignore */
  }
}
