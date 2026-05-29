import React, { useEffect, useRef, useState } from 'react';

export interface GeneratorResult {
  dataUrl: string;
}

interface Props {
  defaultTitle?: string;
  defaultPrice?: string;
  baseImage?: string; // optional uploaded/product photo to composite
  onGenerate: (result: GeneratorResult) => void;
}

interface Template {
  id: string;
  label: string;
  colors: [string, string];
  text: string; // text color
  accent: string; // badge color
}

const TEMPLATES: Template[] = [
  { id: 'sunset', label: 'Sunset', colors: ['#FE2C55', '#FF6B81'], text: '#ffffff', accent: '#25F4EE' },
  { id: 'ocean', label: 'Ocean', colors: ['#0066B3', '#1DC8FF'], text: '#ffffff', accent: '#FFD700' },
  { id: 'mint', label: 'Mint', colors: ['#11998e', '#38ef7d'], text: '#04261f', accent: '#FE2C55' },
  { id: 'gold', label: 'Gold', colors: ['#b8860b', '#FFD700'], text: '#1a1400', accent: '#FE2C55' },
  { id: 'noir', label: 'Noir', colors: ['#111111', '#3a3a3a'], text: '#ffffff', accent: '#25F4EE' },
  { id: 'grape', label: 'Grape', colors: ['#6a11cb', '#b06ab3'], text: '#ffffff', accent: '#FFD700' },
];

const RATIOS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'square', label: '1:1', w: 800, h: 800 },
  { id: 'portrait', label: '4:5', w: 800, h: 1000 },
  { id: 'story', label: '9:16', w: 720, h: 1280 },
];

export const WebImageGenerator: React.FC<Props> = ({ defaultTitle = '', defaultPrice = '', baseImage, onGenerate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [price, setPrice] = useState(defaultPrice);
  const [badge, setBadge] = useState('NOUVEAU');
  const [template, setTemplate] = useState<Template>(TEMPLATES[0]);
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [photo, setPhoto] = useState<string | undefined>(baseImage);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = ratio.w;
    canvas.height = ratio.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = ratio;

    // background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, template.colors[0]);
    grad.addColorStop(1, template.colors[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // soft decorative circles
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(w * 0.85, h * 0.18, w * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.1, h * 0.9, w * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const drawOverlayAndText = () => {
      // gradient scrim at bottom for legibility
      const scrim = ctx.createLinearGradient(0, h * 0.45, 0, h);
      scrim.addColorStop(0, 'rgba(0,0,0,0)');
      scrim.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);

      // badge
      if (badge.trim()) {
        ctx.fillStyle = template.accent;
        const bx = w * 0.06, by = h * 0.06, bw = Math.min(w * 0.5, 40 + badge.length * 22), bh = 64;
        roundRect(ctx, bx, by, bw, bh, 14);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.font = '700 34px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(badge.toUpperCase().slice(0, 14), bx + 20, by + bh / 2 + 2);
      }

      // title (wrapped)
      ctx.fillStyle = template.text === '#ffffff' ? '#ffffff' : template.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const titleSize = Math.round(w * 0.075);
      ctx.font = `800 ${titleSize}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 8;
      wrapText(ctx, title || 'Mon produit', w * 0.06, h * 0.82, w * 0.88, titleSize * 1.15, 3);
      ctx.shadowBlur = 0;

      // price pill
      if (price.trim()) {
        ctx.font = '800 44px sans-serif';
        const label = price.includes('€') || price.includes('FCFA') ? price : `${price} €`;
        const tw = ctx.measureText(label).width;
        const px = w * 0.06, py = h * 0.9, pw = tw + 48, ph = 70;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, px, py, pw, ph, 35);
        ctx.fill();
        ctx.fillStyle = template.colors[0];
        ctx.textBaseline = 'middle';
        ctx.fillText(label, px + 24, py + ph / 2 + 2);
      }
    };

    if (photo) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // cover-fit the photo into the top ~60%
        const targetH = h * 0.62;
        const scale = Math.max(w / img.width, targetH / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, targetH);
        ctx.clip();
        ctx.drawImage(img, (w - dw) / 2, (targetH - dh) / 2, dw, dh);
        ctx.restore();
        drawOverlayAndText();
      };
      img.onerror = () => drawOverlayAndText();
      img.src = photo;
    } else {
      // big emoji/icon center
      ctx.font = `${Math.round(w * 0.28)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.9;
      ctx.fillText('🛍️', w / 2, h * 0.34);
      ctx.globalAlpha = 1;
      drawOverlayAndText();
    }
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, price, badge, template, ratio, photo]);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleUse = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onGenerate({ dataUrl });
    } catch {
      // tainted (cross-origin photo) → regenerate without photo
      setPhoto(undefined);
      setTimeout(() => {
        const c = canvasRef.current;
        if (c) onGenerate({ dataUrl: c.toDataURL('image/jpeg', 0.85) });
      }, 60);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `produit-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch {
      /* ignore taint */
    }
  };

  return (
    <div style={S.root}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickPhoto} />

      {/* Live preview */}
      <div style={S.stage}>
        <canvas ref={canvasRef} style={S.canvas} />
      </div>

      {/* Ratio */}
      <div style={S.sectionLabel}>Format</div>
      <div style={S.row}>
        {RATIOS.map((r) => (
          <button key={r.id} style={{ ...S.chip, ...(ratio.id === r.id ? S.chipActive : {}) }} onClick={() => setRatio(r)}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Templates */}
      <div style={S.sectionLabel}>Style</div>
      <div style={S.row}>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            style={{
              ...S.swatch,
              background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`,
              outline: template.id === t.id ? '2px solid #fff' : 'none',
            }}
            onClick={() => setTemplate(t)}
            title={t.label}
          />
        ))}
      </div>

      {/* Fields */}
      <div style={S.sectionLabel}>Texte</div>
      <input style={S.input} placeholder="Titre du produit" value={title} maxLength={48} onChange={(e) => setTitle(e.target.value)} />
      <div style={S.fieldRow}>
        <input style={{ ...S.input, flex: 1 }} placeholder="Prix (ex: 49.90)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input style={{ ...S.input, flex: 1 }} placeholder="Badge (NOUVEAU)" value={badge} maxLength={14} onChange={(e) => setBadge(e.target.value)} />
      </div>

      {/* Photo source */}
      <div style={S.row}>
        <button style={S.sourceBtn} onClick={() => fileRef.current?.click()}>🖼️ Ajouter une photo</button>
        {photo && <button style={S.sourceBtn} onClick={() => setPhoto(undefined)}>✕ Retirer la photo</button>}
      </div>

      {/* Actions */}
      <div style={S.actions}>
        <button style={S.downloadBtn} onClick={handleDownload}>⬇️ Télécharger</button>
        <button style={S.useBtn} onClick={handleUse}>Utiliser cette image →</button>
      </div>
    </div>
  );
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const shown = lines.slice(0, maxLines);
  // bottom-align block
  const startY = y - (shown.length - 1) * lineHeight;
  shown.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight));
}

const BRAND = '#FE2C55';
const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%', color: '#fff' },
  stage: { width: '100%', display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 14, padding: 12, overflow: 'hidden' },
  canvas: { maxWidth: '100%', maxHeight: 360, borderRadius: 10, objectFit: 'contain' },
  sectionLabel: { fontSize: 13, fontWeight: 700, marginTop: 4 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  chip: { background: '#1E1E1E', color: '#cfcfcf', borderWidth: 1, borderStyle: 'solid', borderColor: '#2A2A2A', borderRadius: 999, padding: '8px 16px', fontSize: 13, cursor: 'pointer' },
  chipActive: { background: '#fff', color: '#000', borderColor: '#fff', fontWeight: 700 },
  swatch: { width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer' },
  input: { background: '#1E1E1E', color: '#fff', borderWidth: 1, borderStyle: 'solid', borderColor: '#2A2A2A', borderRadius: 10, padding: '11px 12px', fontSize: 14, outline: 'none' },
  fieldRow: { display: 'flex', gap: 8 },
  sourceBtn: { flex: '1 0 auto', background: '#1E1E1E', color: '#fff', borderWidth: 1, borderStyle: 'solid', borderColor: '#2A2A2A', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  actions: { display: 'flex', gap: 8, marginTop: 6 },
  downloadBtn: { flex: 1, background: '#1E1E1E', color: '#fff', borderWidth: 1, borderStyle: 'solid', borderColor: '#2A2A2A', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  useBtn: { flex: 2, background: BRAND, color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
};

export default WebImageGenerator;
