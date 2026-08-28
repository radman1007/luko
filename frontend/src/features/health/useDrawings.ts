import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isGuestMode } from '@/features/auth/guest';
import { drawingsApi } from './api';
import type { NewDrawing } from './api';

const KEY = ['health', 'drawings'];

/**
 * گالریِ نقاشی‌ها.
 *
 * مهمان حسابِ سروری ندارد، پس چیزی برایش نگه داشته نمی‌شود و گالری‌اش
 * خالی می‌ماند؛ نقاشیِ همان لحظه‌اش مثل قبل محلی ذخیره می‌شود.
 */
export function useDrawings() {
  const guest = isGuestMode();

  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: drawingsApi.list,
    enabled: !guest,
    staleTime: 30_000,
  });

  return { drawings: data ?? [], loading: !guest && isLoading, guest };
}

export function useDeleteDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => drawingsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (drawing: NewDrawing) => drawingsApi.save(drawing),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
