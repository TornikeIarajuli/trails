import api from './api';

export const notificationsService = {
  async registerToken(token: string, platform = 'expo'): Promise<{ registered: boolean }> {
    const response = await api.post('/notifications/register-token', { token, platform });
    return response.data;
  },

  async removeToken(token: string): Promise<{ removed: boolean }> {
    const response = await api.delete('/notifications/remove-token', {
      data: { token },
    });
    return response.data;
  },
};
