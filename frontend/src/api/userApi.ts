import { authFetch } from './fetchClient';
import { ApiResponse } from './apiResponse';
import { authStorage } from '@/utils/authStorage';
import { BaseApi } from './baseApi';
import { CurrentUserResponse, LoginRequest, LoginResponse } from '@/models';

export const API_BASE_URL =
  process.env.NEXUS_API_URL || 'http://localhost:3003';

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

  //If we need
  async logout(): Promise<ApiResponse<null>> {
    authStorage.clearAuth();
    return await this.handleRequest(() =>
      authFetch('/auth/logout', { method: 'POST' })
    );
  }

  //If we need
  async getCurrentUser(): Promise<ApiResponse<CurrentUserResponse>> {
    return this.handleRequest(() => authFetch('/auth/me'));
  }
}

export const userApi = new UserApi();
