import api from './api';

async function uploadFile(
  endpoint: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  const { data } = await api.post(endpoint, blob, {
    headers: {
      'Content-Type': mimeType,
      'x-file-name': fileName,
      ...extraHeaders,
    },
    transformRequest: (d) => d,
  });

  return data;
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

  async uploadHikePhoto(
    trailId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<any> {
    const extra: Record<string, string> = { 'x-media-type': 'photo' };
    if (caption) extra['x-caption'] = caption;
    return uploadFile(`/media/trail/${trailId}`, fileUri, fileName, mimeType, extra);
  },
};
