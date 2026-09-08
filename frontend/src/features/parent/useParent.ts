/**
 * هوک‌های پنل والدین — همه‌ی درخواست‌ها یک‌جا تا صفحه‌ها فقط رندر باشند.
 * کلیدهای کوئری با شناسه‌ی فرزند جدا می‌شوند تا سوییچِ فرزند، کشِ درست را بردارد.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parentApi } from './api';
import type { ParentPreferences } from './types';

const MINUTE = 60 * 1000;

export const parentKeys = {
  children: ['parent', 'children'] as const,
  report: (childId: string) => ['parent', 'report', childId] as const,
  assignments: (childId: string) => ['parent', 'assignments', childId] as const,
  suggestions: (childId: string) => ['parent', 'suggestions', childId] as const,
  preferences: ['parent', 'preferences'] as const,
  notifications: ['parent', 'notifications'] as const,
  tickets: ['parent', 'tickets'] as const,
};

export function useChildren() {
  return useQuery({
    queryKey: parentKeys.children,
    queryFn: parentApi.children,
    staleTime: 2 * MINUTE,
  });
}

export function useReport(childId?: string) {
  return useQuery({
    queryKey: parentKeys.report(childId ?? ''),
    queryFn: () => parentApi.report(childId as string),
    enabled: Boolean(childId),
    staleTime: MINUTE,
  });
}

export function useSuggestions(childId?: string) {
  return useQuery({
    queryKey: parentKeys.suggestions(childId ?? ''),
    queryFn: () => parentApi.suggestions(childId as string),
    enabled: Boolean(childId),
    staleTime: MINUTE,
  });
}

export function useAssignments(childId?: string) {
  return useQuery({
    queryKey: parentKeys.assignments(childId ?? ''),
    queryFn: () => parentApi.assignments(childId as string),
    enabled: Boolean(childId),
    staleTime: MINUTE,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: parentKeys.notifications,
    queryFn: parentApi.notifications,
    staleTime: MINUTE,
    refetchOnWindowFocus: true,
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: parentKeys.preferences,
    queryFn: parentApi.preferences,
    staleTime: 5 * MINUTE,
  });
}

export function useTickets() {
  return useQuery({
    queryKey: parentKeys.tickets,
    queryFn: parentApi.tickets,
    staleTime: MINUTE,
  });
}

/** ثبتِ بازی روز — بعدش هم پیشنهادها و هم فهرستِ برنامه‌ها تازه می‌شوند */
export function useSetAssignment(childId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { gameSlug: string; date: string; note?: string }) =>
      parentApi.setAssignment(childId as string, payload),
    onSuccess: () => {
      if (!childId) return;
      client.invalidateQueries({ queryKey: parentKeys.assignments(childId) });
      client.invalidateQueries({ queryKey: parentKeys.suggestions(childId) });
    },
  });
}

export function useAddChild() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: parentApi.addChild,
    onSuccess: () => client.invalidateQueries({ queryKey: parentKeys.children }),
  });
}

/** رمزِ فرزند — فقط وقتی والد بازش می‌کند خوانده می‌شود، نه در فهرست */
export function useChildPassword(childId: string | null) {
  return useQuery({
    queryKey: [...parentKeys.children, childId, 'password'],
    queryFn: () => parentApi.childPassword(childId as string),
    enabled: Boolean(childId),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useSetChildPassword(childId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      parentApi.setChildPassword(childId as string, password),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [...parentKeys.children, childId, 'password'] }),
  });
}

export function useRemoveChild() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: parentApi.removeChild,
    onSuccess: () => client.invalidateQueries({ queryKey: parentKeys.children }),
  });
}

/** سوییچ‌های تنظیمات — خوش‌بینانه جابه‌جا می‌شوند تا کلیک، لَگ نداشته باشد */
export function useSetPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ParentPreferences>) => parentApi.setPreferences(payload),
    onMutate: async (payload) => {
      await client.cancelQueries({ queryKey: parentKeys.preferences });
      const previous = client.getQueryData<ParentPreferences>(parentKeys.preferences);
      if (previous) {
        client.setQueryData<ParentPreferences>(parentKeys.preferences, { ...previous, ...payload });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) client.setQueryData(parentKeys.preferences, context.previous);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: parentKeys.preferences });
      client.invalidateQueries({ queryKey: parentKeys.notifications });
    },
  });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: parentApi.markNotificationsRead,
    onSuccess: () => client.invalidateQueries({ queryKey: parentKeys.notifications }),
  });
}

export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: parentApi.createTicket,
    onSuccess: () => client.invalidateQueries({ queryKey: parentKeys.tickets }),
  });
}
