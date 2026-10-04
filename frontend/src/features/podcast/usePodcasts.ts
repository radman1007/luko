import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cacheOwner } from '@/lib/queryClient';
import { podcastApi } from './api';
import { podcastIcon } from './icons';
import type { PodcastDto, PodcastEpisode } from './types';

export function toEpisode(dto: PodcastDto): PodcastEpisode {
  return {
    id: String(dto.id),
    title: dto.title,
    category: dto.category,
    durationMinutes: dto.durationMinutes ?? 0,
    icon: podcastIcon(dto.icon ?? '', dto.category),
    audioUrl: dto.audioUrl ?? '',
    listened: Boolean(dto.listened),
  };
}

/** کلیدِ هر بچه جداست: «گوش‌داده‌شده»ی یک حساب نباید بعد از ورودِ دیگری دیده شود */
export const podcastKeys = {
  all: ['podcasts'] as const,
  list: (owner: string) => ['podcasts', owner] as const,
};

/**
 * قسمت‌های لوکو پادکست از سرور — همان‌هایی که در پنلِ ادمین بارگذاری شده‌اند.
 * تا ۴ اکتبر ۲۰۲۶ صفحه فهرستِ ثابتِ نمونه را نشان می‌داد و هیچ پادکستی از ادمین
 * به سایت نمی‌رسید. مهمان هم همین فهرستِ واقعی را می‌گیرد (API عمومی است).
 */
export function usePodcasts() {
  const owner = cacheOwner() ?? 'anon';
  const query = useQuery({
    queryKey: podcastKeys.list(owner),
    queryFn: podcastApi.list,
    staleTime: 5 * 60_000,
  });
  const episodes = useMemo(() => (query.data?.episodes ?? []).map(toEpisode), [query.data]);
  const today = useMemo(() => (query.data?.today ? toEpisode(query.data.today) : null), [query.data]);
  return {
    episodes,
    today,
    isLoading: query.isLoading,
    isError: query.isError && !query.data,
    refetch: query.refetch,
  };
}
