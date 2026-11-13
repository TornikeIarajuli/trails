import axios, { AxiosRequestConfig } from 'axios';
import api from './api';
import { Config } from '../constants/config';
import { AuthResponse } from '../types/api';

// Signing in is often the first request after the API host has been idle
const SLOW_START: AxiosRequestConfig = { timeout: Config.COLD_START_TIMEOUT_MS };

export const authService = {
  async signup(data: {
    email: string;
    password: string;
    username: string;
    full_name?: string;
  }): Promise<AuthResponse> {
    const response = await api.post('/auth/signup', data, SLOW_START);
    return response.data;
  },

  async login(data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data, SLOW_START);
    return response.data;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const response = await api.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/forgot-password', { email }, SLOW_START);
    return response.data;
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  /** Asks the server to revoke the session. Best effort: signing out locally never waits for it. */
  async logout(config?: AxiosRequestConfig): Promise<void> {
    await api.post('/auth/logout', undefined, config);
  },

  /**
   * Sets a new password with the token from a password-reset link. That token
   * belongs to a recovery session, not to the signed-in session, so the request
   * bypasses the API client and its token handling.
   */
  async updatePassword(recoveryAccessToken: string, password: string): Promise<{ message: string }> {
    const response = await axios.post(
      `${Config.API_BASE_URL}/auth/update-password`,
      { password },
      {
        timeout: Config.COLD_START_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${recoveryAccessToken}` },
      },
    );
    return response.data;
  },
};
