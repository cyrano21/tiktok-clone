import { ingestComposition, MediaPipelineError, type CompositionClip } from './video.service';

function clip(index: number): CompositionClip {
  return {
    id: `clip-${index}`,
    sourceField: 'source_0',
    kind: 'video',
    trimStart: 0,
    trimEnd: 1,
    imageDuration: 0,
    overlayText: '',
    filters: {},
    transition: 'none',
  };
}

describe('ingestComposition guardrails', () => {
  it('refuse une composition sans source', async () => {
    await expect(ingestComposition({ sources: [], clips: [clip(0)] })).rejects.toMatchObject({
      code: 'INVALID_COMPOSITION',
      statusCode: 400,
    } satisfies Partial<MediaPipelineError>);
  });

  it('refuse plus de huit sources avant tout accès disque', async () => {
    const sources = Array.from({ length: 9 }, (_, index) => ({
      fieldName: `source_${index}`,
      filePath: `/does-not-exist/${index}`,
      filename: `${index}.mp4`,
      mimetype: 'video/mp4',
    }));

    await expect(ingestComposition({ sources, clips: [clip(0)] })).rejects.toMatchObject({
      code: 'INVALID_COMPOSITION',
      statusCode: 400,
    } satisfies Partial<MediaPipelineError>);
  });

  it('refuse plus de vingt clips avant tout accès disque', async () => {
    const sources = [{
      fieldName: 'source_0',
      filePath: '/does-not-exist/source.mp4',
      filename: 'source.mp4',
      mimetype: 'video/mp4',
    }];
    const clips = Array.from({ length: 21 }, (_, index) => clip(index));

    await expect(ingestComposition({ sources, clips })).rejects.toMatchObject({
      code: 'INVALID_COMPOSITION',
      statusCode: 400,
    } satisfies Partial<MediaPipelineError>);
  });
});
