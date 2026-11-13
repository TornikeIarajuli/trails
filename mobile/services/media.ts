import api from './api';
import { TrailMedia } from '../types/trail';
import { TrailPhoto } from '../types/community';
import { getErrorMessage, getErrorStatus } from '../utils/showError';

// A photo over mobile data routinely takes longer than the API client's 15 s default.
const UPLOAD_TIMEOUT_MS = 120_000;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_CAPTION_LENGTH = 300;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

function extensionOf(name: string | null | undefined): string | null {
  if (!name) return null;
  const lastSegment = name.split(/[?#]/)[0].split('/').pop() ?? '';
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(lastSegment);
  return match ? match[1].toLowerCase() : null;
}

function extensionOfMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  const match = Object.entries(MIME_BY_EXTENSION).find(([, mime]) => mime === mimeType.toLowerCase());
  return match ? match[0] : null;
}

/**
 * File name and MIME type to upload a picked image with. The name is rebuilt as
 * plain ASCII: it travels in an HTTP header, and the server only ever reads its
 * extension.
 */
export function describeImageUpload(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): { fileName: string; mimeType: string } {
  const ext =
    extensionOf(asset.fileName) ?? extensionOf(asset.uri) ?? extensionOfMime(asset.mimeType) ?? 'jpg';
  const mimeType = MIME_BY_EXTENSION[ext] ?? asset.mimeType ?? `image/${ext}`;
  return { fileName: `photo.${ext}`, mimeType };
}

function headerSafeFileName(fileName: string, mimeType: string): string {
  const ext = extensionOf(fileName) ?? extensionOfMime(mimeType) ?? 'jpg';
  const base = (fileName.split(/[?#]/)[0].split('/').pop() ?? '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 60);
  return `${base || 'upload'}.${ext}`;
}

/** Caption header value per the upload contract: URI-encoded UTF-8, at most 300 characters. */
export function encodeCaption(caption: string): string {
  return encodeURIComponent(caption.trim().slice(0, MAX_CAPTION_LENGTH));
}

export function getUploadErrorMessage(err: unknown): string {
  const status = getErrorStatus(err);
  if (status === 413) return 'That photo is too large. The limit is 12 MB.';
  if (status === 415) {
    return 'That file type is not supported. Please choose a JPEG, PNG, WebP or HEIC photo.';
  }
  return getErrorMessage(err, 'Failed to upload the photo. Please try again.');
}

async function uploadFile<T>(
  endpoint: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  const { data } = await api.post(endpoint, blob, {
    timeout: UPLOAD_TIMEOUT_MS,
    headers: {
      'Content-Type': mimeType,
      'x-file-name': headerSafeFileName(fileName, mimeType),
      ...extraHeaders,
    },
    transformRequest: (d) => d,
  });

  return data;
}

function photoHeaders(caption?: string): Record<string, string> {
  const headers: Record<string, string> = { 'x-media-type': 'photo' };
  if (caption?.trim()) headers['x-caption'] = encodeCaption(caption);
  return headers;
}

export const mediaService = {
  async uploadProofPhoto(
    fileUri: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ url: string }> {
    return uploadFile('/media/proof', fileUri, fileName, mimeType);
  },

  async uploadAvatar(
    fileUri: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ url: string }> {
    return uploadFile('/media/avatar', fileUri, fileName, mimeType);
  },

  /**
   * Uploads a community photo. The server stores the file AND creates the
   * `trail_photos` row — do not also call `POST /community/photos`.
   */
  async uploadHikePhoto(
    trailId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<TrailPhoto> {
    return uploadFile(`/media/hike-photo/${trailId}`, fileUri, fileName, mimeType, photoHeaders(caption));
  },

  /** Admin only: adds a photo to the trail's own gallery (`trail_media`). */
  async uploadTrailMedia(
    trailId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<TrailMedia> {
    return uploadFile(`/media/trail/${trailId}`, fileUri, fileName, mimeType, photoHeaders(caption));
  },
};
