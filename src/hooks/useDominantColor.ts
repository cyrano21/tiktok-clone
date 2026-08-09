import { useEffect, useRef, useState } from 'react';

// Cache module-level pour éviter de ré-analyser la même image.
const cache = new Map<string, string>();

export function colorName(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (s < 0.12) {
    if (l > 0.82) return 'Blanc';
    if (l > 0.62) return 'Gris clair';
    if (l > 0.38) return 'Gris';
    if (l > 0.2) return 'Gris foncé';
    return 'Noir';
  }
  const hue = Math.round(
    max === r ? ((g - b) / (max - min)) * 60 : max === g ? ((b - r) / (max - min)) * 60 + 120 : ((r - g) / (max - min)) * 60 + 240
  ) + 360;
  const hh = hue % 360;
  if (hh < 12 || hh >= 348) return 'Rouge';
  if (hh < 35) return 'Orange';
  if (hh < 62) return 'Jaune';
  if (hh < 155) return 'Vert';
  if (hh < 190) return 'Turquoise';
  if (hh < 260) return 'Bleu';
  if (hh < 290) return 'Violet';
  if (hh < 330) return 'Rose';
  return 'Rouge';
}

async function extractDominant(imageUrl: string): Promise<string | null> {
  // CORS-safe extraction via canvas (same-origin images, tiktokcdn, alicdn…).
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('load failed'));
      setTimeout(() => reject(new Error('timeout')), 8000);
    });
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    // Moyenne pondérée des pixels non-transparents (les fonds blancs sont
    // neutralisés pour éviter des « blancs » systématiques).
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      if (a < 0.3) continue;
      r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a; count += a;
    }
    if (count === 0) return null;
    const toHex = (v: number) => Math.round(v / count).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  } catch {
    return null;
  }
}

export function useDominantColor(imageUrl: string | null | undefined): {
  hex: string | null;
  name: string;
  loading: boolean;
} {
  const [hex, setHex] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const urlRef = useRef(imageUrl);

  useEffect(() => {
    if (!imageUrl) {
      setHex(null);
      setLoading(false);
      return;
    }
    if (urlRef.current !== imageUrl) {
      setHex(null);
      setLoading(true);
      urlRef.current = imageUrl;
    }
    const cached = cache.get(imageUrl);
    if (cached) {
      setHex(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void extractDominant(imageUrl).then((value) => {
      if (cancelled) return;
      if (value) cache.set(imageUrl, value);
      setHex(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return { hex, name: hex ? colorName(hex) : '', loading };
}
