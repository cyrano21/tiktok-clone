import { useStudioStore } from '../../src/store/studioStore';

describe('studioStore analytics', () => {
  it('starts with no invented posts or synthetic metrics', () => {
    const first = useStudioStore.getState().analytics();
    const second = useStudioStore.getState().analytics();

    // Stable across reads, but empty: no seeded Picsum posts, no fake metrics.
    expect(second).toEqual(first);
    expect(first.dailyViews).toHaveLength(7);
    expect(first.postsCount).toBe(0);
    expect(useStudioStore.getState().posts).toHaveLength(0);
  });
});
