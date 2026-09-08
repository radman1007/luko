import { apiClient } from '@/lib/api';
import type { Child, ChildReport, ParentNotification, ParentPreferences, Suggestion } from './types';

export interface Assignment {
  id: number;
  gameSlug: string;
  gameTitle: string;
  bookTitle: string;
  date: string;
  note: string;
  played: boolean;
}

export interface CatalogGame {
  slug: string;
  title: string;
  bookTitle: string;
  subject: string;
  coinReward: number;
}

export interface Ticket {
  id: number;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  lastMessageAt: string;
  messages: {
    id: number;
    body: string;
    isStaffReply: boolean;
    senderName: string;
    createdAt: string;
  }[];
}

/** همه‌ی درخواست‌های پنل والدین. پاکتِ {data} در همین‌جا باز می‌شود. */
export const parentApi = {
  async children(): Promise<Child[]> {
    const { data } = await apiClient.get('/parent/children');
    return data.data;
  },

  async addChild(payload: {
    phone: string;
    /** رمزِ ورودِ فرزند — همان چیزی که بچه‌های هم‌شماره را از هم جدا می‌کند */
    password: string;
    firstName?: string;
    lastName?: string;
    grade?: number;
    school?: string;
  }): Promise<Child> {
    const { data } = await apiClient.post('/parent/children', payload);
    return data.data;
  },

  /**
   * رمزِ خوانای فرزند.
   *
   * بچه‌ی کلاس‌اولی رمزش را فراموش می‌کند و خودش راهی برای بازیابی ندارد
   * (فراموشیِ رمز در پنلِ دانش‌آموز عمداً نیست)، پس والد باید ببیندش.
   */
  async childPassword(childId: string): Promise<{ password: string; hasPassword: boolean }> {
    const { data } = await apiClient.get(`/parent/children/${childId}/password`);
    return data.data;
  },

  async setChildPassword(childId: string, password: string): Promise<void> {
    await apiClient.post(`/parent/children/${childId}/password`, { password });
  },

  /**
   * گامِ ۱ تغییرِ شماره: کد هم به شماره‌ی فعلی می‌رود هم به شماره‌ی تازه.
   *
   * هر دو لازم‌اند: اولی ثابت می‌کند شماره‌ی فعلی دستِ خانواده است،
   * دومی جلوی تایپِ اشتباهِ شماره‌ی مقصد را می‌گیرد.
   */
  async startChildPhoneChange(childId: string, phone: string): Promise<{
    currentPhone: string;
    newPhone: string;
    codeLength?: number;
    resendIn?: number;
    devCurrentCode?: string;
    devNewCode?: string;
  }> {
    const { data } = await apiClient.post(`/parent/children/${childId}/phone/start`, { phone });
    return data.data;
  },

  async confirmChildPhoneChange(
    childId: string,
    payload: { phone: string; currentCode: string; newCode: string },
  ): Promise<{ phone: string }> {
    const { data } = await apiClient.post(
      `/parent/children/${childId}/phone/confirm`, payload);
    return data.data;
  },

  async removeChild(childId: string): Promise<void> {
    await apiClient.delete(`/parent/children/${childId}`);
  },

  async report(childId: string): Promise<ChildReport> {
    const { data } = await apiClient.get(`/parent/children/${childId}/report`);
    return data.data;
  },

  async assignments(childId: string, history = false): Promise<Assignment[]> {
    const { data } = await apiClient.get(
      `/parent/children/${childId}/assignments${history ? '?history=1' : ''}`,
    );
    return data.data;
  },

  async setAssignment(
    childId: string,
    payload: { gameSlug: string; date: string; note?: string },
  ): Promise<Assignment> {
    const { data } = await apiClient.post(`/parent/children/${childId}/assignments`, payload);
    return data.data;
  },

  async removeAssignment(childId: string, id: number): Promise<void> {
    await apiClient.delete(`/parent/children/${childId}/assignments/${id}`);
  },

  /** کاتالوگ بازی‌ها برای انتخابگرِ «بازی روز» */
  async catalog(): Promise<CatalogGame[]> {
    const { data } = await apiClient.get('/books');
    const books = data.data.books as {
      title: string;
      subject: string;
      levels: { slug: string; title: string; coinReward: number }[];
    }[];
    return books.flatMap((book) =>
      book.levels.map((level) => ({
        slug: level.slug,
        title: level.title,
        bookTitle: book.title,
        subject: book.subject,
        coinReward: level.coinReward,
      })),
    );
  },

  async tickets(): Promise<Ticket[]> {
    const { data } = await apiClient.get('/tickets');
    return data.data;
  },

  async createTicket(payload: { subject: string; body: string }): Promise<Ticket> {
    const { data } = await apiClient.post('/tickets', payload);
    return data.data;
  },

  async replyTicket(id: number, body: string): Promise<void> {
    await apiClient.post(`/tickets/${id}/reply`, { body });
  },

  /** پیشنهادِ بازی روز — بر اساسِ ضعیف‌ترین مبحثِ همین بچه */
  async suggestions(childId: string): Promise<{
    date: string;
    currentSlug: string | null;
    suggestions: Suggestion[];
  }> {
    const { data } = await apiClient.get(`/parent/children/${childId}/suggestions`);
    return data.data;
  },

  async preferences(): Promise<ParentPreferences> {
    const { data } = await apiClient.get('/parent/preferences');
    return data.data;
  },

  async setPreferences(payload: Partial<ParentPreferences>): Promise<ParentPreferences> {
    const { data } = await apiClient.patch('/parent/preferences', payload);
    return data.data;
  },

  async notifications(): Promise<{ items: ParentNotification[]; unread: number }> {
    const { data } = await apiClient.get('/parent/notifications');
    return data.data;
  },

  async markNotificationsRead(): Promise<void> {
    await apiClient.post('/parent/notifications/read');
  },
};
