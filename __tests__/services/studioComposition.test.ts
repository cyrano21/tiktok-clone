jest.mock('@/services/api', () => ({
  apiClient: {
    get: jest.fn(),
    upload: jest.fn(),
  },
}));

import { apiClient } from '@/services/api';
import { studioService, type PublishCompositionManifest } from '@/services/studioService';

const uploadMock = apiClient.upload as jest.Mock;

const manifest: PublishCompositionManifest = {
  version: 1,
  clips: [
    {
      id: 'clip-1',
      sourceField: 'source_0',
      kind: 'video',
      trimStart: 1,
      trimEnd: 4,
      imageDuration: 0,
      overlayText: 'Découvre le produit',
      filters: { brightness: 100, contrast: 100, saturate: 115, sepia: 0, grayscale: 0 },
      transition: 'fade',
    },
  ],
};

describe('studioService.publishComposition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    uploadMock.mockResolvedValue({
      video: {
        id: 'video-1',
        videoUrl: 'ignored-public-url',
        thumbnailUrl: 'ignored-thumbnail-url',
        duration: 3,
        width: 1080,
        height: 1920,
        description: 'demo',
      },
    });
  });

  it('envoie le manifeste et les sources sur le endpoint de composition', async () => {
    const blob = new Blob(['video'], { type: 'video/mp4' });

    const video = await studioService.publishComposition(
      [{ fieldName: 'source_0', blob, filename: 'source.mp4', mimetype: 'video/mp4' }],
      manifest,
      { description: '#demo', visibility: 'public' },
    );

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [endpoint, form] = uploadMock.mock.calls[0] as [string, FormData];
    expect(endpoint).toBe('/videos/compose');
    expect(form.get('description')).toBe('#demo');
    expect(form.get('visibility')).toBe('public');
    expect(form.get('composition')).toBe(JSON.stringify(manifest));
    expect((form.get('source_0') as Blob).size).toBe(blob.size);
    expect(video.videoUrl).toBe('/v1/media/videos/video-1');
    expect(video.thumbnailUrl).toBe('/v1/media/thumbnails/video-1');
  });

  it('refuse les champs source dupliqués avant tout appel réseau', async () => {
    const blob = new Blob(['x'], { type: 'video/mp4' });

    await expect(studioService.publishComposition(
      [
        { fieldName: 'source_0', blob, filename: 'a.mp4', mimetype: 'video/mp4' },
        { fieldName: 'source_0', blob, filename: 'b.mp4', mimetype: 'video/mp4' },
      ],
      manifest,
      { description: 'demo' },
    )).rejects.toThrow('Identifiant de source de montage invalide');

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('refuse un clip qui référence une source absente', async () => {
    const blob = new Blob(['x'], { type: 'video/mp4' });
    const missingManifest: PublishCompositionManifest = {
      ...manifest,
      clips: [{ ...manifest.clips[0], sourceField: 'source_1' }],
    };

    await expect(studioService.publishComposition(
      [{ fieldName: 'source_0', blob, filename: 'a.mp4', mimetype: 'video/mp4' }],
      missingManifest,
      { description: 'demo' },
    )).rejects.toThrow('Un clip référence une source absente');

    expect(uploadMock).not.toHaveBeenCalled();
  });
});
