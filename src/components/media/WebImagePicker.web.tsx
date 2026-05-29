import React, { useRef } from 'react';

interface Props {
  images: string[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
}

// Real multi-image picker using a hidden file input (web only).
export const WebImagePicker: React.FC<Props> = ({ images, onAdd, onRemove }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      onAdd(url);
    });
    e.target.value = '';
  };

  return (
    <div style={S.wrap}>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onPick} />
      {images.map((src, i) => (
        <div key={src + i} style={S.thumb}>
          <img src={src} style={S.img} alt={`img-${i}`} />
          <button style={S.remove} onClick={() => onRemove(i)} aria-label="remove">✕</button>
        </div>
      ))}
      <button style={S.add} onClick={() => inputRef.current?.click()}>
        <span style={{ fontSize: 26, lineHeight: '26px' }}>＋</span>
        <span style={{ fontSize: 11 }}>Photo</span>
      </button>
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  thumb: { position: 'relative', width: 84, height: 110, borderRadius: 10, overflow: 'hidden', background: '#1E1E1E' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  remove: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12,
  },
  add: {
    width: 84, height: 110, borderRadius: 10, border: '1px dashed #3a3a3a', background: '#161616',
    color: '#8A8B91', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 4, cursor: 'pointer',
  },
};

export default WebImagePicker;
