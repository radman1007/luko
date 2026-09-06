import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isGuestMode } from '@/features/auth/guest';
import { memoriesApi } from './api';
import type { NewMemory, SeasonMemory } from './api';

/**
 * یادگاری‌های یک سیزن، کلید‌خورده به شناسه‌ی نقطه.
 *
 * مهمان حسابِ سروری ندارد، پس چیزی برایش نگه داشته نمی‌شود و نقاطِ
 * یادگاری خالی می‌مانند — همان رفتاری که گالریِ نقاشی هم دارد.
 */
export function useMemories(seasonId: string) {
  const guest = isGuestMode();
  const key = ['games', 'memories', seasonId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => memoriesApi.list(seasonId),
    enabled: !guest,
    staleTime: 60_000,
  });

  const bySpot = useMemo(() => {
    const map = new Map<string, SeasonMemory>();
    (data ?? []).forEach((memory) => map.set(memory.spotId, memory));
    return map;
  }, [data]);

  return { bySpot, loading: !guest && isLoading, guest };
}

export function useSaveMemory(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memory: NewMemory) => memoriesApi.save(memory),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['games', 'memories', seasonId] }),
  });
}

export function useDeleteMemory(seasonId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => memoriesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['games', 'memories', seasonId] }),
  });
}
