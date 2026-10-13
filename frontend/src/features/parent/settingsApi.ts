import { apiClient } from '@/lib/api';
import type { ChildProfile, NewTicket, TicketDetail, TicketList, TicketStatus } from './settingsTypes';

/** درخواست‌های بخش‌های تنظیمات؛ پاکتِ {data} همین‌جا باز می‌شود */
export const settingsApi = {
  async childProfile(childId: string): Promise<ChildProfile> {
    const { data } = await apiClient.get(`/parent/children/${childId}/profile`);
    return data.data;
  },

  async updateChild(childId: string, payload: { firstName?: string; lastName?: string; school?: string }): Promise<ChildProfile> {
    const { data } = await apiClient.patch(`/parent/children/${childId}`, payload);
    return data.data;
  },

  async passwordStatus(): Promise<{ hasPassword: boolean }> {
    const { data } = await apiClient.get('/parent/password');
    return data.data;
  },

  async changePassword(payload: { current?: string; password: string }): Promise<void> {
    await apiClient.post('/parent/password', payload);
  },

  async tickets(status?: TicketStatus): Promise<TicketList> {
    const { data } = await apiClient.get('/tickets', { params: status ? { status } : undefined });
    return data.data;
  },

  async ticket(id: number): Promise<TicketDetail> {
    const { data } = await apiClient.get(`/tickets/${id}`);
    return data.data;
  },

  async createTicket(payload: NewTicket): Promise<TicketDetail> {
    const { data } = await apiClient.post('/tickets', payload);
    return data.data;
  },

  async replyTicket(id: number, body: string): Promise<TicketDetail> {
    const { data } = await apiClient.post(`/tickets/${id}/reply`, { body });
    return data.data;
  },

  async closeTicket(id: number): Promise<TicketDetail> {
    const { data } = await apiClient.post(`/tickets/${id}/close`);
    return data.data;
  },

  async rateTicket(id: number, rating: number, comment: string): Promise<TicketDetail> {
    const { data } = await apiClient.post(`/tickets/${id}/rate`, { rating, comment });
    return data.data;
  },
};

/** پیامِ خطای سرور (پاکتِ {error}) یا متنِ پیش‌فرض */
export function apiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string; details?: Record<string, string[]> } } } };
  const error = e?.response?.data?.error;
  const first = error?.details ? Object.values(error.details).flat()[0] : undefined;
  return first || error?.message || fallback;
}
