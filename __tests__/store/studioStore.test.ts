import { useStudioStore } from '../../src/store/studioStore';

describe('studioStore demo analytics', () => {
  it('keeps seeded post metrics stable across analytics reads', () => {
    const first = useStudioStore.getState().analytics();
    const second = useStudioStore.getState().analytics();

    expect(second).toEqual(first);
    expect(first.dailyViews).toHaveLength(7);
    expect(first.postsCount).toBeGreaterThan(0);
  });
});
