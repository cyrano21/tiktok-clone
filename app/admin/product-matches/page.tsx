'use client';

import { useEffect, useState, useCallback } from 'react';

interface ProductMatch {
  orchidyCatalogItemId: string;
  confidence: number;
  status: 'suggested' | 'approved';
  source: string;
}

interface Video {
  id: string;
  title: string;
  source: string;
  productMatches: ProductMatch[];
  views?: number;
}

export default function ProductMatchesAdmin() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'suggested' | 'approved'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/scraper/videos?limit=200');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const approveMatch = async (videoId: string, itemId: string) => {
    const key = `${videoId}:${itemId}`;
    setActionLoading(key);
    try {
      const res = await fetch(`/api/scraper/videos/${videoId}/product-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orchidyCatalogItemId: itemId,
          variantKey: '',
          confidence: 1,
          source: 'admin_manual',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await fetchVideos();
    } catch (e: any) {
      alert(`Approval failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const removeMatch = async (videoId: string, itemId: string) => {
    const key = `${videoId}:${itemId}`;
    setActionLoading(key);
    try {
      const res = await fetch(`/api/scraper/videos/${videoId}/product-matches?itemId=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await fetchVideos();
    } catch (e: any) {
      alert(`Removal failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Batch approve all suggested matches for the selected videos
  const approveBatch = async () => {
    if (selected.size === 0) return;
    setBatchLoading(true);
    setBatchResult(null);
    let ok = 0;
    let failed = 0;
    for (const videoId of selected) {
      const video = videos.find((v) => v.id === videoId);
      const suggested = video?.productMatches.filter((m) => m.status === 'suggested') ?? [];
      for (const m of suggested) {
        try {
          const res = await fetch(`/api/scraper/videos/${videoId}/product-matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orchidyCatalogItemId: m.orchidyCatalogItemId,
              variantKey: '',
              confidence: 1,
              source: 'admin_manual',
            }),
          });
          if (res.ok) ok += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
    }
    setBatchResult(`Batch done: ${ok} approved, ${failed} failed`);
    setSelected(new Set());
    setBatchLoading(false);
    await fetchVideos();
  };

  const toggleSelect = (videoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const filteredVideos = videos.filter((v) => {
    if (filter === 'all') return true;
    return v.productMatches.some((m) => m.status === filter);
  });

  const stats = {
    total: videos.length,
    withMatches: videos.filter((v) => v.productMatches.length > 0).length,
    suggested: videos.reduce((sum, v) => sum + v.productMatches.filter((m) => m.status === 'suggested').length, 0),
    approved: videos.reduce((sum, v) => sum + v.productMatches.filter((m) => m.status === 'approved').length, 0),
  };

  const matchRate = stats.total > 0 ? Math.round((stats.withMatches / stats.total) * 100) : 0;
  const totalMatches = stats.suggested + stats.approved;
  const approvalRate = totalMatches > 0 ? Math.round((stats.approved / totalMatches) * 100) : 0;

  // Analytics bars
  const analytics = [
    {
      label: 'Match rate',
      value: matchRate,
      color: '#2563eb',
      detail: `${stats.withMatches} / ${stats.total} videos with at least one match`,
    },
    {
      label: 'Approval rate',
      value: approvalRate,
      color: '#10b981',
      detail: `${stats.approved} approved / ${totalMatches} total matches`,
    },
  ];

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>🎥 Product Matches Admin</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Manage video→product associations for scraper videos</p>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Videos', value: stats.total, color: '#333' },
          { label: 'With Matches', value: stats.withMatches, color: '#2563eb' },
          { label: 'Suggested', value: stats.suggested, color: '#f59e0b' },
          { label: 'Approved', value: stats.approved, color: '#10b981' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#666' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Match analytics */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        {analytics.map((a) => (
          <div key={a.label} style={{ flex: '1 1 320px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: a.color }}>{a.value}%</span>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${a.value}%`, background: a.color, height: '100%', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>{a.detail}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['all', 'suggested', 'approved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: filter === f ? '2px solid #2563eb' : '1px solid #d1d5db',
              background: filter === f ? '#eff6ff' : '#fff',
              color: filter === f ? '#2563eb' : '#374151',
              cursor: 'pointer',
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {/* Batch approve */}
        <button
          onClick={approveBatch}
          disabled={selected.size === 0 || batchLoading}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            background: selected.size > 0 ? '#10b981' : '#e5e7eb',
            color: selected.size > 0 ? '#fff' : '#9ca3af',
            cursor: selected.size > 0 && !batchLoading ? 'pointer' : 'default',
            fontWeight: 600,
          }}
        >
          {batchLoading ? 'Approving…' : `✓ Approve ${selected.size} selected`}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}
          >
            Clear
          </button>
        )}
        {batchResult && <span style={{ fontSize: 13, color: '#374151' }}>{batchResult}</span>}

        <button
          onClick={fetchVideos}
          disabled={loading}
          style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: loading ? 'default' : 'pointer' }}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div style={{ color: '#dc2626', marginBottom: 16 }}>Error: {error}</div>}

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', width: 40 }}>
              <input
                type="checkbox"
                checked={filteredVideos.length > 0 && filteredVideos.every((v) => selected.has(v.id))}
                onChange={() => {
                  if (filteredVideos.every((v) => selected.has(v.id))) setSelected(new Set());
                  else setSelected(new Set(filteredVideos.map((v) => v.id)));
                }}
              />
            </th>
            <th style={{ padding: '8px 12px' }}>Video</th>
            <th style={{ padding: '8px 12px', width: 80 }}>Views</th>
            <th style={{ padding: '8px 12px' }}>Product Matches</th>
            <th style={{ padding: '8px 12px', width: 120 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredVideos.map((video) => (
            <tr key={video.id} style={{ borderBottom: '1px solid #f3f4f6', background: selected.has(video.id) ? '#f0fdf4' : undefined }}>
              <td style={{ padding: '8px 12px' }}>
                <input
                  type="checkbox"
                  checked={selected.has(video.id)}
                  onChange={() => toggleSelect(video.id)}
                />
              </td>
              <td style={{ padding: '8px 12px' }}>
                <div style={{ fontWeight: 500 }}>{video.title || video.id.slice(0, 20)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{video.id}</div>
              </td>
              <td style={{ padding: '8px 12px', color: '#6b7280' }}>
                {video.views?.toLocaleString() ?? '—'}
              </td>
              <td style={{ padding: '8px 12px' }}>
                {video.productMatches.length === 0 ? (
                  <span style={{ color: '#9ca3af' }}>No matches</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {video.productMatches.map((m) => (
                      <div key={m.orchidyCatalogItemId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500,
                            background: m.status === 'approved' ? '#d1fae5' : '#fef3c7',
                            color: m.status === 'approved' ? '#065f46' : '#92400e',
                          }}
                        >
                          {m.status}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.orchidyCatalogItemId.slice(0, 30)}</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>{(m.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td style={{ padding: '8px 12px' }}>
                {video.productMatches.some((m) => m.status === 'suggested') && (
                  <button
                    onClick={() => {
                      const suggested = video.productMatches.find((m) => m.status === 'suggested');
                      if (suggested) approveMatch(video.id, suggested.orchidyCatalogItemId);
                    }}
                    disabled={actionLoading === `${video.id}:${video.productMatches.find((m) => m.status === 'suggested')?.orchidyCatalogItemId}`}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#10b981',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      marginRight: 4,
                    }}
                  >
                    ✓ Approve
                  </button>
                )}
                {video.productMatches.some((m) => m.status === 'approved') && (
                  <button
                    onClick={() => {
                      const approved = video.productMatches.find((m) => m.status === 'approved');
                      if (approved) removeMatch(video.id, approved.orchidyCatalogItemId);
                    }}
                    disabled={actionLoading === `${video.id}:${video.productMatches.find((m) => m.status === 'approved')?.orchidyCatalogItemId}`}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: '1px solid #dc2626',
                      background: '#fff',
                      color: '#dc2626',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredVideos.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          No videos match the current filter.
        </div>
      )}
    </div>
  );
}
