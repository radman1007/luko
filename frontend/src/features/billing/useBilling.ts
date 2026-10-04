import { useMutation, useQuery } from '@tanstack/react-query';
import { billingApi } from './api';
import { goToGateway } from './gateway';

const MINUTE = 60 * 1000;

export const billingKeys = {
  plans: ['billing', 'plans'] as const,
  children: ['billing', 'children'] as const,
  payments: (childId?: string) => ['billing', 'payments', childId ?? 'all'] as const,
  payment: (id: number) => ['billing', 'payment', id] as const,
};

export function usePlans(enabled = true) {
  return useQuery({ queryKey: billingKeys.plans, queryFn: billingApi.plans, staleTime: 10 * MINUTE, enabled });
}

/** وضعیتِ اشتراکِ همه‌ی فرزندان — نشانِ نوار و صفحه‌ی اشتراک */
export function useSubscriptions(enabled = true) {
  return useQuery({
    queryKey: billingKeys.children,
    queryFn: billingApi.children,
    staleTime: MINUTE,
    enabled,
  });
}

export function usePayments(childId?: string, enabled = true) {
  return useQuery({
    queryKey: billingKeys.payments(childId),
    queryFn: () => billingApi.payments(childId),
    staleTime: 30 * 1000,
    enabled,
  });
}

/** پرداخت را می‌سازد و مرورگر را به درگاهِ وندار می‌برد */
export function useCheckout() {
  return useMutation({
    mutationFn: ({ childId, plan }: { childId: string; plan: string }) => billingApi.checkout(childId, plan),
    onSuccess: (result) => goToGateway(result.payUrl),
  });
}
