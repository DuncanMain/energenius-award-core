import { authFetch } from './fetchClient';
import { ApiResponse } from './apiResponse';
import { authStorage } from '@/utils/authStorage';
import { BaseApi } from './baseApi';
import { CurrentUserResponse, LoginRequest, LoginResponse, LogoutResponse } from '@/models';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_NEXUS_API_URL ||
  'https://energenius-nexus.zentrix.io';

class UserApi extends BaseApi {
  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return await this.handleRequest(() =>
      fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-type': 'application/json' },
        body: JSON.stringify(data),
      })
    );
  }

  async logout(data : {username: string}): Promise<ApiResponse<LogoutResponse>> {
    authStorage.clearAuth();
    return await this.handleRequest(() =>
      authFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', body: JSON.stringify(data) })
    );
  }

  async getCurrentUser(): Promise<ApiResponse<CurrentUserResponse>> {
    return this.handleRequest(() => authFetch('/auth/me'));
  }
}

export const userApi = new UserApi();
