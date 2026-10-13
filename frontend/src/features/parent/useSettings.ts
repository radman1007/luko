/**
 * هوک‌های بخش‌های تنظیمات. همه `enabled` دارند: مهمان API ندارد و دادهٔ نمونه می‌بیند.
 * هر تغییرِ تیکت، فهرست و همان تیکت را تازه می‌کند تا شمارِ «خوانده‌نشده» درست بماند.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from './settingsApi';
import type { NewTicket, TicketDetail, TicketStatus } from './settingsTypes';
import { parentKeys } from './useParent';

const MINUTE = 60 * 1000;

export const settingsKeys = {
  profile: (childId: string) => ['parent', 'child-profile', childId] as const,
  password: ['parent', 'password'] as const,
  tickets: (status?: TicketStatus) => ['parent', 'tickets', status ?? 'all'] as const,
  ticket: (id: number) => ['parent', 'ticket', id] as const,
};

export function useChildProfile(childId?: string, enabled = true) {
  return useQuery({
    queryKey: settingsKeys.profile(childId ?? ''),
    queryFn: () => settingsApi.childProfile(childId as string),
    enabled: enabled && Boolean(childId),
    staleTime: MINUTE,
  });
}

export function useUpdateChild(childId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { firstName?: string; lastName?: string; school?: string }) =>
      settingsApi.updateChild(childId, payload),
    onSuccess: (profile) => {
      client.setQueryData(settingsKeys.profile(childId), profile);
      client.invalidateQueries({ queryKey: parentKeys.children });
      client.invalidateQueries({ queryKey: parentKeys.report(childId) });
    },
  });
}

export function usePasswordStatus(enabled = true) {
  return useQuery({ queryKey: settingsKeys.password, queryFn: settingsApi.passwordStatus, enabled, staleTime: 5 * MINUTE });
}

export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.changePassword,
    onSuccess: () => client.setQueryData(settingsKeys.password, { hasPassword: true }),
  });
}

export function useTicketList(status?: TicketStatus, enabled = true) {
  return useQuery({
    queryKey: settingsKeys.tickets(status),
    queryFn: () => settingsApi.tickets(status),
    enabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useTicket(id: number, enabled = true) {
  return useQuery({
    queryKey: settingsKeys.ticket(id),
    queryFn: () => settingsApi.ticket(id),
    enabled: enabled && id > 0,
    refetchOnWindowFocus: true,
  });
}

/** بعد از هر تغییرِ تیکت: خودِ تیکت با پاسخِ سرور، و همه‌ی فهرست‌ها دوباره */
function useTicketSync() {
  const client = useQueryClient();
  return (ticket: TicketDetail) => {
    client.setQueryData(settingsKeys.ticket(ticket.id), ticket);
    client.invalidateQueries({ queryKey: ['parent', 'tickets'] });
  };
}

export function useCreateTicket() {
  const sync = useTicketSync();
  return useMutation({ mutationFn: (payload: NewTicket) => settingsApi.createTicket(payload), onSuccess: sync });
}

export function useReplyTicket(id: number) {
  const sync = useTicketSync();
  return useMutation({ mutationFn: (body: string) => settingsApi.replyTicket(id, body), onSuccess: sync });
}

export function useCloseTicket(id: number) {
  const sync = useTicketSync();
  return useMutation({ mutationFn: () => settingsApi.closeTicket(id), onSuccess: sync });
}

export function useRateTicket(id: number) {
  const sync = useTicketSync();
  return useMutation({
    mutationFn: ({ rating, comment }: { rating: number; comment: string }) => settingsApi.rateTicket(id, rating, comment),
    onSuccess: sync,
  });
}
