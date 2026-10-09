import { apiClient } from '@/lib/api';

export interface KidNotice {
  id: number;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  at: string;
}

export interface KidNoticeList {
  items: KidNotice[];
  unread: number;
}

export const noticesApi = {
  list: async (): Promise<KidNoticeList> => (await apiClient.get('/notices')).data.data,
  markRead: async (): Promise<void> => {
    await apiClient.post('/notices/read');
  },
};
