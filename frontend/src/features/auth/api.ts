import { apiClient, tokenStorage } from '@/lib/api';
import type { User } from '@/types/user';

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<User> {
    const { data } = await apiClient.post('/auth/login', payload);
    tokenStorage.set(data.data.accessToken);
    return data.data.user;
  },

  async register(payload: RegisterPayload): Promise<User> {
    const { data } = await apiClient.post('/auth/register', payload);
    tokenStorage.set(data.data.accessToken);
    return data.data.user;
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get('/auth/me');
    return data.data;
  },

  logout() {
    tokenStorage.clear();
  },
};
