import api from './api';

/** A "Back by" check-in (see the API's CheckinsService). */
export interface CheckIn {
  id: string;
  trail_id: string | null;
  trail_name: string | null;
  /** 'alerted': the emergency contact was told the hiker is late. */
  status: 'active' | 'alerted';
  back_by: string;
  started_at: string;
  reminded_at: string | null;
  alerted_at: string | null;
  last_position_at: string | null;
}

export interface CheckInState {
  check_in: CheckIn | null;
  emergency_contact: { id: string; username: string } | null;
}

export const checkinsService = {
  async get(): Promise<CheckInState> {
    const response = await api.get('/users/me/check-in');
    return response.data;
  },

  /** Starts or updates the check-in of the hike in progress. */
  async set(data: { trail_id: string; back_by: string; lat?: number; lng?: number }): Promise<void> {
    await api.put('/users/me/check-in', data);
  },

  /** The hiker is back: closes the open check-in (only if it is for this trail, when given). */
  async finish(trailId?: string | null): Promise<void> {
    await api.delete('/users/me/check-in', { params: trailId ? { trail_id: trailId } : {} });
  },
};
