export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    user_metadata: {
      username: string;
      full_name?: string;
    };
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}
