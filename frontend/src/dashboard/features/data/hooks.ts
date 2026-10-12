/**
 * همه‌ی پرس‌وجوها و تغییرهای داشبورد. کلیدها با پارامترهای فیلتر عوض می‌شوند؛
 * هنگامِ بارگذاریِ دوباره دادهٔ قبلی می‌ماند (placeholderData) تا صفحه نپرد.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getData, send } from '../../lib/api';
import type {
  Analytics, AuditRow, BlogDetail, BlogRow, ConceptRow, Meta, NoticeRow, Online, Overview, Paged, PaymentRow,
  PodcastRow, StaffRow, TicketDetail, TicketRow, UnknownConcept, UserDetail, UserRow,
} from '../../types';

type Params = Record<string, string>;

function useList<T>(key: string, url: string, params: Params, enabled = true) {
  return useQuery({
    queryKey: [key, params],
    queryFn: () => getData<T>(url, params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => getData<Meta>('meta'), staleTime: 10 * 60_000 });
export const useOverview = () => useQuery({ queryKey: ['overview'], queryFn: () => getData<Overview>('overview'),
  refetchInterval: 60_000 });
export const useOnline = () => useQuery({ queryKey: ['online'], queryFn: () => getData<Online>('online'),
  refetchInterval: 20_000 });
export const useAnalytics = (params: Params) => useList<Analytics>('analytics', 'analytics', params);

export const useUsers = (params: Params) =>
  useList<Paged<UserRow> & { summary: { students: number; parents: number } }>('users', 'users', params);
export const useUser = (id: string) => useQuery({ queryKey: ['user', id], queryFn: () => getData<UserDetail>(`users/${id}`) });

export const usePayments = (params: Params) =>
  useList<Paged<PaymentRow> & { summary: { count: number; paid: number; paidToman: number; gifts: number } }>(
    'payments', 'payments', params);

export const useTickets = (params: Params) =>
  useList<Paged<TicketRow> & { counts: Record<string, number> }>('tickets', 'tickets', params);
export const useTicket = (id: string) => useQuery({ queryKey: ['ticket', id], queryFn: () => getData<TicketDetail>(`tickets/${id}`) });

export const usePodcasts = (params: Params) => useList<Paged<PodcastRow>>('podcasts', 'podcasts', params);
export const useBlog = (params: Params) => useList<Paged<BlogRow> & { categories: string[] }>('blog', 'blog', params);
export const usePost = (id: string, enabled: boolean) =>
  useQuery({ queryKey: ['post', id], queryFn: () => getData<BlogDetail>(`blog/${id}`), enabled });

export const useConcepts = (params: Params) => useList<Paged<ConceptRow>>('concepts', 'concepts', params);
export const useUnknownConcepts = () =>
  useQuery({ queryKey: ['concepts', 'unknown'], queryFn: () => getData<{ results: UnknownConcept[] }>('concepts/unknown') });

export const useNotices = (params: Params) => useList<Paged<NoticeRow>>('notices', 'notices', params);
export const useStaff = () => useQuery({ queryKey: ['staff'], queryFn: () => getData<{ results: StaffRow[] }>('staff') });
export const useAudit = (params: Params) => useList<Paged<AuditRow>>('audit', 'audit', params);

/** تغییر + تازه‌کردنِ کلیدهای وابسته */
export function useAction<TBody, TResult = unknown>(
  method: 'post' | 'patch' | 'delete',
  url: string | ((body: TBody) => string),
  invalidate: string[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => send<TResult>(method, typeof url === 'function' ? url(body) : url, body),
    onSuccess: () => Promise.all(invalidate.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  });
}
