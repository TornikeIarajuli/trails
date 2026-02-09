import { Config } from '../constants/config';
import { useAuthStore } from '../store/authStore';

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function uploadFile(
  endpoint: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'x-file-name': fileName,
      ...getAuthHeaders(),
      ...extraHeaders,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
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
