import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'fs';
import { mkdtemp, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { s3Client, S3_BUCKET, CDN_URL } from '../config/s3';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_COMPOSITION_SOURCE_BYTES = 400 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 10 * 60;
const DEFAULT_IMAGE_DURATION_SECONDS = 5;
const COMPOSITION_WIDTH = 1080;
const COMPOSITION_HEIGHT = 1920;
const COMPOSITION_FPS = 30;

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type MediaFilterSettings = {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  sepia?: number;
  grayscale?: number;
};

export type IngestMediaOptions = {
  stream: Readable;
  filename: string;
  mimetype: string;
  trimStart?: number;
  trimEnd?: number;
  overlayText?: string;
  filters?: MediaFilterSettings;
};

export type CompositionSource = {
  fieldName: string;
  filePath: string;
  filename: string;
  mimetype: string;
};

export type CompositionClip = {
  id: string;
  sourceField: string;
  kind: 'video' | 'image';
  trimStart: number;
  trimEnd: number;
  imageDuration: number;
  overlayText: string;
  filters: MediaFilterSettings;
  transition: 'none' | 'fade';
};

export type IngestCompositionOptions = {
  sources: CompositionSource[];
  clips: CompositionClip[];
};

export type IngestedMedia = {
  videoKey: string;
  videoUrl: string;
  thumbnailKey: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  sourceSizeBytes: number;
};

export class MediaPipelineError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = code;
    this.code = code;
    this.statusCode = statusCode;
  }
}

function mediaExtension(mimetype: string) {
  const extensions: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return extensions[mimetype] ?? 'bin';
}

function publicUrlForKey(key: string) {
  return `${CDN_URL.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
}

export function objectKeyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${CDN_URL.replace(/\/$/, '')}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  if (!key || key.includes('..') || key.startsWith('/')) return null;
  return key;
}

export async function deleteMediaObjects(keys: Array<string | null | undefined>) {
  const uniqueKeys = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  await Promise.allSettled(uniqueKeys.map((key) => s3Client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }))));
}

export async function deleteMediaUrls(urls: Array<string | null | undefined>) {
  await deleteMediaObjects(urls.map(objectKeyFromPublicUrl));
}

async function uploadFileToS3(filePath: string, mimetype: string, folder: string, extension: string) {
  const key = `${folder}/${randomUUID()}.${extension}`;
  const fileStat = await stat(filePath);

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: mimetype,
    ContentLength: fileStat.size,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, url: publicUrlForKey(key) };
}

function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => {
      reject(new MediaPipelineError(
        'MEDIA_PROCESSOR_UNAVAILABLE',
        `Unable to start ${command}: ${error.message}`,
        503,
      ));
    });
    child.once('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new MediaPipelineError(
        'MEDIA_PROCESSING_FAILED',
        `${command} exited with code ${code}: ${stderr.slice(-1500)}`,
        422,
      ));
    });
  });
}

type ProbeResult = {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
};

async function probe(filePath: string): Promise<ProbeResult> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  let parsed: any;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new MediaPipelineError('INVALID_MEDIA', 'ffprobe returned invalid metadata', 422);
  }

  const videoStream = (parsed.streams ?? []).find((stream: any) => stream.codec_type === 'video');
  if (!videoStream) throw new MediaPipelineError('INVALID_MEDIA', 'No video/image stream found', 422);

  const duration = Number(videoStream.duration ?? parsed.format?.duration ?? 0);
  const width = Number(videoStream.width ?? 0);
  const height = Number(videoStream.height ?? 0);
  const hasAudio = Boolean((parsed.streams ?? []).some((stream: any) => stream.codec_type === 'audio'));

  return {
    duration: Number.isFinite(duration) ? duration : 0,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    hasAudio,
  };
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

function escapeFilterPath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function sepiaFilter(amountPercent: number) {
  const s = Math.min(1, Math.max(0, amountPercent / 100));
  const rr = 1 - 0.607 * s;
  const rg = 0.769 * s;
  const rb = 0.189 * s;
  const gr = 0.349 * s;
  const gg = 1 - 0.314 * s;
  const gb = 0.168 * s;
  const br = 0.272 * s;
  const bg = 0.534 * s;
  const bb = 1 - 0.869 * s;
  return `colorchannelmixer=rr=${rr.toFixed(4)}:rg=${rg.toFixed(4)}:rb=${rb.toFixed(4)}:gr=${gr.toFixed(4)}:gg=${gg.toFixed(4)}:gb=${gb.toFixed(4)}:br=${br.toFixed(4)}:bg=${bg.toFixed(4)}:bb=${bb.toFixed(4)}`;
}

function colorFilters(filters: MediaFilterSettings | undefined) {
  const brightness = clamp(filters?.brightness, 50, 150, 100);
  const contrast = clamp(filters?.contrast, 50, 150, 100);
  const saturation = clamp(filters?.saturate, 0, 200, 100);
  const sepia = clamp(filters?.sepia, 0, 100, 0);
  const grayscale = clamp(filters?.grayscale, 0, 100, 0);

  const chain = [
    `eq=brightness=${((brightness - 100) / 200).toFixed(3)}:contrast=${(contrast / 100).toFixed(3)}:saturation=${(saturation / 100).toFixed(3)}`,
  ];
  if (sepia > 0) chain.push(sepiaFilter(sepia));
  if (grayscale >= 50) chain.push('hue=s=0');
  return chain;
}

function buildVideoFilters(filters: MediaFilterSettings | undefined, overlayFile: string | null) {
  const chain = [
    'scale=w=min(1080\\,iw):h=min(1920\\,ih):force_original_aspect_ratio=decrease',
    // yuv420p/libx264 requires even output dimensions.
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    ...colorFilters(filters),
  ];

  if (overlayFile) {
    chain.push(
      `drawtext=textfile='${escapeFilterPath(overlayFile)}':fontcolor=white:fontsize=h/24:box=1:boxcolor=black@0.35:boxborderw=12:x=(w-text_w)/2:y=(h-text_h)/2`,
    );
  }

  return chain.join(',');
}

function buildCompositionFilters(
  filters: MediaFilterSettings | undefined,
  overlayFile: string | null,
  duration: number,
  transition: 'none' | 'fade',
) {
  const chain = [
    `scale=w=${COMPOSITION_WIDTH}:h=${COMPOSITION_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${COMPOSITION_WIDTH}:${COMPOSITION_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`,
    'setsar=1',
    ...colorFilters(filters),
  ];

  if (overlayFile) {
    chain.push(
      `drawtext=textfile='${escapeFilterPath(overlayFile)}':fontcolor=white:fontsize=h/24:box=1:boxcolor=black@0.35:boxborderw=12:x=(w-text_w)/2:y=(h-text_h)/2`,
    );
  }

  if (transition === 'fade' && duration >= 0.6) {
    const fadeDuration = Math.min(0.25, duration / 4);
    const fadeOutStart = Math.max(0, duration - fadeDuration);
    chain.push(`fade=t=in:st=0:d=${fadeDuration.toFixed(3)}`);
    chain.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}`);
  }

  return chain.join(',');
}

function buildCompositionAudioFilters(duration: number, transition: 'none' | 'fade') {
  const chain = ['aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo'];
  if (transition === 'fade' && duration >= 0.6) {
    const fadeDuration = Math.min(0.25, duration / 4);
    const fadeOutStart = Math.max(0, duration - fadeDuration);
    chain.push(`afade=t=in:st=0:d=${fadeDuration.toFixed(3)}`);
    chain.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}`);
  }
  return chain.join(',');
}

async function transcode(
  inputPath: string,
  outputPath: string,
  inputKind: 'video' | 'image',
  options: IngestMediaOptions,
  overlayFile: string | null,
) {
  const trimStart = Math.max(0, Number(options.trimStart ?? 0));
  const requestedTrimEnd = Math.max(0, Number(options.trimEnd ?? 0));
  const args: string[] = ['-hide_banner', '-loglevel', 'error'];

  if (inputKind === 'image') {
    args.push('-loop', '1', '-i', inputPath, '-t', String(DEFAULT_IMAGE_DURATION_SECONDS));
  } else {
    if (trimStart > 0) args.push('-ss', trimStart.toFixed(3));
    args.push('-i', inputPath);
    if (requestedTrimEnd > trimStart) {
      args.push('-t', Math.min(MAX_VIDEO_DURATION_SECONDS, requestedTrimEnd - trimStart).toFixed(3));
    } else {
      args.push('-t', String(MAX_VIDEO_DURATION_SECONDS));
    }
  }

  args.push(
    '-vf', buildVideoFilters(options.filters, overlayFile),
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-r', '30',
  );

  if (inputKind === 'image') args.push('-an');
  else args.push('-c:a', 'aac', '-b:a', '128k');

  args.push('-y', outputPath);
  await run('ffmpeg', args);
}

async function renderCompositionSegment(
  source: CompositionSource,
  sourceProbe: ProbeResult,
  clip: CompositionClip,
  outputPath: string,
  overlayFile: string | null,
) {
  const duration = clip.kind === 'image'
    ? clip.imageDuration
    : clip.trimEnd - clip.trimStart;
  const args: string[] = ['-hide_banner', '-loglevel', 'error'];

  if (clip.kind === 'image') {
    args.push('-loop', '1', '-t', duration.toFixed(3), '-i', source.filePath);
  } else {
    if (clip.trimStart > 0) args.push('-ss', clip.trimStart.toFixed(3));
    args.push('-t', duration.toFixed(3), '-i', source.filePath);
  }

  const needsSilentAudio = clip.kind === 'image' || !sourceProbe.hasAudio;
  if (needsSilentAudio) {
    args.push(
      '-f', 'lavfi',
      '-t', duration.toFixed(3),
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    );
  }

  args.push(
    '-map', '0:v:0',
    '-map', needsSilentAudio ? '1:a:0' : '0:a:0',
    '-vf', buildCompositionFilters(clip.filters, overlayFile, duration, clip.transition),
    '-af', buildCompositionAudioFilters(duration, clip.transition),
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-pix_fmt', 'yuv420p',
    '-r', String(COMPOSITION_FPS),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-shortest',
    '-movflags', '+faststart',
    '-y', outputPath,
  );
  await run('ffmpeg', args);
}

async function makeThumbnail(videoPath: string, thumbnailPath: string, duration: number) {
  const seek = duration > 1 ? Math.min(1, duration / 3) : 0;
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-ss', seek.toFixed(3),
    '-i', videoPath,
    '-frames:v', '1',
    '-vf', 'scale=360:-2',
    '-q:v', '3',
    '-y', thumbnailPath,
  ]);
}

async function persistInput(stream: Readable, path: string) {
  let size = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        callback(new MediaPipelineError('MEDIA_TOO_LARGE', 'Media exceeds the 100 MB upload limit', 413));
        return;
      }
      callback(null, chunk);
    },
  });

  await pipeline(stream, limiter, createWriteStream(path, { flags: 'wx' }));
  return size;
}

export async function ingestMedia(options: IngestMediaOptions): Promise<IngestedMedia> {
  const inputKind = VIDEO_TYPES.has(options.mimetype)
    ? 'video'
    : IMAGE_TYPES.has(options.mimetype)
      ? 'image'
      : null;

  if (!inputKind) {
    throw new MediaPipelineError(
      'UNSUPPORTED_MEDIA_TYPE',
      `Unsupported media type: ${options.mimetype}`,
      415,
    );
  }

  const workspace = await mkdtemp(join(tmpdir(), 'tiktok-media-'));
  const inputPath = join(workspace, `source.${mediaExtension(options.mimetype)}`);
  const outputPath = join(workspace, 'processed.mp4');
  const thumbnailPath = join(workspace, 'thumbnail.jpg');
  const overlayText = options.overlayText?.trim().slice(0, 120) ?? '';
  const overlayFile = overlayText ? join(workspace, 'overlay.txt') : null;
  const uploadedKeys: string[] = [];

  try {
    const sourceSizeBytes = await persistInput(options.stream, inputPath);
    if (sourceSizeBytes === 0) throw new MediaPipelineError('EMPTY_MEDIA', 'Uploaded media is empty', 400);

    const sourceProbe = await probe(inputPath);
    if (inputKind === 'video' && sourceProbe.duration > MAX_VIDEO_DURATION_SECONDS && !options.trimEnd) {
      throw new MediaPipelineError(
        'MEDIA_TOO_LONG',
        `Video duration exceeds ${MAX_VIDEO_DURATION_SECONDS / 60} minutes; trim it before publishing`,
        422,
      );
    }

    if (overlayFile) await writeFile(overlayFile, overlayText, 'utf8');

    await transcode(inputPath, outputPath, inputKind, options, overlayFile);
    const processed = await probe(outputPath);
    if (!processed.width || !processed.height || !processed.duration) {
      throw new MediaPipelineError('INVALID_MEDIA_OUTPUT', 'Processed video metadata is incomplete', 422);
    }

    await makeThumbnail(outputPath, thumbnailPath, processed.duration);

    const video = await uploadFileToS3(outputPath, 'video/mp4', 'videos', 'mp4');
    uploadedKeys.push(video.key);
    const thumbnail = await uploadFileToS3(thumbnailPath, 'image/jpeg', 'thumbnails', 'jpg');
    uploadedKeys.push(thumbnail.key);

    return {
      videoKey: video.key,
      videoUrl: video.url,
      thumbnailKey: thumbnail.key,
      thumbnailUrl: thumbnail.url,
      duration: processed.duration,
      width: processed.width,
      height: processed.height,
      sourceSizeBytes,
    };
  } catch (error) {
    await deleteMediaObjects(uploadedKeys);
    throw error;
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function ingestComposition(options: IngestCompositionOptions): Promise<IngestedMedia> {
  if (!options.sources.length || options.sources.length > 8) {
    throw new MediaPipelineError('INVALID_COMPOSITION', 'Composition requires between 1 and 8 source files', 400);
  }
  if (!options.clips.length || options.clips.length > 20) {
    throw new MediaPipelineError('INVALID_COMPOSITION', 'Composition requires between 1 and 20 clips', 400);
  }

  const sourceMap = new Map<string, CompositionSource>();
  let sourceSizeBytes = 0;
  for (const source of options.sources) {
    if (!/^source_\d+$/.test(source.fieldName) || sourceMap.has(source.fieldName)) {
      throw new MediaPipelineError('INVALID_COMPOSITION_SOURCE', 'Invalid or duplicated composition source field', 400);
    }
    const kind = VIDEO_TYPES.has(source.mimetype) ? 'video' : IMAGE_TYPES.has(source.mimetype) ? 'image' : null;
    if (!kind) {
      throw new MediaPipelineError('UNSUPPORTED_MEDIA_TYPE', `Unsupported source type: ${source.mimetype}`, 415);
    }
    const sourceStat = await stat(source.filePath);
    if (!sourceStat.size || sourceStat.size > MAX_UPLOAD_BYTES) {
      throw new MediaPipelineError('MEDIA_TOO_LARGE', 'Each composition source must be between 1 byte and 100 MB', 413);
    }
    sourceSizeBytes += sourceStat.size;
    sourceMap.set(source.fieldName, source);
  }
  if (sourceSizeBytes > MAX_COMPOSITION_SOURCE_BYTES) {
    throw new MediaPipelineError('COMPOSITION_TOO_LARGE', 'Composition source files exceed the 400 MB aggregate limit', 413);
  }

  const probeMap = new Map<string, ProbeResult>();
  for (const [fieldName, source] of sourceMap) {
    probeMap.set(fieldName, await probe(source.filePath));
  }

  let totalDuration = 0;
  for (const clip of options.clips) {
    const source = sourceMap.get(clip.sourceField);
    const sourceProbe = probeMap.get(clip.sourceField);
    if (!source || !sourceProbe) {
      throw new MediaPipelineError('INVALID_COMPOSITION', `Clip ${clip.id} references a missing source`, 400);
    }
    const actualKind = VIDEO_TYPES.has(source.mimetype) ? 'video' : 'image';
    if (actualKind !== clip.kind) {
      throw new MediaPipelineError('INVALID_COMPOSITION', `Clip ${clip.id} media kind does not match its source`, 400);
    }

    if (clip.kind === 'video') {
      const duration = clip.trimEnd - clip.trimStart;
      if (!Number.isFinite(duration) || duration < 0.2 || clip.trimStart < 0 || clip.trimEnd <= clip.trimStart) {
        throw new MediaPipelineError('INVALID_COMPOSITION', `Clip ${clip.id} has invalid trim bounds`, 400);
      }
      if (clip.trimEnd > sourceProbe.duration + 0.25) {
        throw new MediaPipelineError('INVALID_COMPOSITION', `Clip ${clip.id} exceeds its source duration`, 400);
      }
      totalDuration += duration;
    } else {
      if (!Number.isFinite(clip.imageDuration) || clip.imageDuration < 1 || clip.imageDuration > 15) {
        throw new MediaPipelineError('INVALID_COMPOSITION', `Clip ${clip.id} has invalid image duration`, 400);
      }
      totalDuration += clip.imageDuration;
    }
  }

  if (!Number.isFinite(totalDuration) || totalDuration <= 0 || totalDuration > MAX_VIDEO_DURATION_SECONDS) {
    throw new MediaPipelineError(
      'COMPOSITION_TOO_LONG',
      `Composition duration must be between 0 and ${MAX_VIDEO_DURATION_SECONDS} seconds`,
      422,
    );
  }

  const workspace = await mkdtemp(join(tmpdir(), 'orky-composition-'));
  const finalPath = join(workspace, 'composition.mp4');
  const thumbnailPath = join(workspace, 'thumbnail.jpg');
  const uploadedKeys: string[] = [];

  try {
    const segmentPaths: string[] = [];
    for (let index = 0; index < options.clips.length; index += 1) {
      const clip = options.clips[index];
      const source = sourceMap.get(clip.sourceField)!;
      const sourceProbe = probeMap.get(clip.sourceField)!;
      const overlayText = clip.overlayText?.trim().slice(0, 120) ?? '';
      const overlayFile = overlayText ? join(workspace, `overlay-${index}.txt`) : null;
      if (overlayFile) await writeFile(overlayFile, overlayText, 'utf8');

      const segmentPath = join(workspace, `segment-${String(index).padStart(2, '0')}.mp4`);
      await renderCompositionSegment(source, sourceProbe, clip, segmentPath, overlayFile);
      const segmentProbe = await probe(segmentPath);
      if (!segmentProbe.width || !segmentProbe.height || !segmentProbe.duration) {
        throw new MediaPipelineError('INVALID_MEDIA_OUTPUT', `Rendered clip ${clip.id} is invalid`, 422);
      }
      segmentPaths.push(segmentPath);
    }

    const concatList = join(workspace, 'segments.txt');
    const concatText = segmentPaths
      .map((path) => `file '${path.replace(/'/g, "'\\''")}'`)
      .join('\n');
    await writeFile(concatList, concatText, 'utf8');
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'concat', '-safe', '0', '-i', concatList,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y', finalPath,
    ]);

    const processed = await probe(finalPath);
    if (!processed.width || !processed.height || !processed.duration) {
      throw new MediaPipelineError('INVALID_MEDIA_OUTPUT', 'Composition output metadata is incomplete', 422);
    }
    if (processed.duration > MAX_VIDEO_DURATION_SECONDS + 1) {
      throw new MediaPipelineError('COMPOSITION_TOO_LONG', 'Rendered composition exceeds the 10 minute limit', 422);
    }

    await makeThumbnail(finalPath, thumbnailPath, processed.duration);
    const video = await uploadFileToS3(finalPath, 'video/mp4', 'videos', 'mp4');
    uploadedKeys.push(video.key);
    const thumbnail = await uploadFileToS3(thumbnailPath, 'image/jpeg', 'thumbnails', 'jpg');
    uploadedKeys.push(thumbnail.key);

    return {
      videoKey: video.key,
      videoUrl: video.url,
      thumbnailKey: thumbnail.key,
      thumbnailUrl: thumbnail.url,
      duration: processed.duration,
      width: processed.width,
      height: processed.height,
      sourceSizeBytes,
    };
  } catch (error) {
    await deleteMediaObjects(uploadedKeys);
    throw error;
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
