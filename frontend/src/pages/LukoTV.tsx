import { useMemo, useState } from 'react';
import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { TvHero } from '@/features/tv/components/TvHero/TvHero';
import { SearchBar } from '@/features/tv/components/SearchBar/SearchBar';
import { CategoryChips } from '@/features/tv/components/CategoryChips/CategoryChips';
import { VideoCard } from '@/features/tv/components/VideoCard/VideoCard';
import { VideoModal } from '@/features/tv/components/VideoModal/VideoModal';
import { MOCK_VIDEOS } from '@/features/tv/tvData';
import type { TvCategory } from '@/features/tv/types';
import { useLikes } from '@/features/tv/useLikes';
import styles from './LukoTV.module.css';

const GUIDE_STEPS = [
  'سلام! من ویدام، مجری تلویزیون شهر لوکو!',
  'اینجا کلی کارتون، قصه و ویدیوی علمی داریم؛ دسته‌ها رو بگرد یا اسمش رو جستجو کن!',
  'هر ویدیویی رو دوست داشتی قلبش رو بزن تا برات نگهش دارم!',
];

export default function LukoTV() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TvCategory | 'همه'>('همه');
  const [activeId, setActiveId] = useState<string | null>(null);
  const { liked, toggleLike } = useLikes();

  const videos = useMemo(() => {
    const q = query.trim();
    return MOCK_VIDEOS.filter(
      (v) => (category === 'همه' || v.category === category) && (!q || v.title.includes(q)),
    );
  }, [query, category]);

  const activeVideo = MOCK_VIDEOS.find((v) => v.id === activeId) ?? null;

  return (
    <StudentLayout className={styles.page}>
      <TvHero />
      <SearchBar value={query} onChange={setQuery} />
      <CategoryChips active={category} onSelect={setCategory} />

      {videos.length === 0 ? (
        <p className={styles.empty}>ویدا چیزی پیدا نکرد! یه اسم دیگه رو امتحان کن.</p>
      ) : (
        <div className={styles.grid}>
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isLiked={liked.includes(video.id)}
              onOpen={setActiveId}
            />
          ))}
        </div>
      )}

      {activeVideo && (
        <VideoModal
          video={activeVideo}
          isLiked={liked.includes(activeVideo.id)}
          onToggleLike={toggleLike}
          onClose={() => setActiveId(null)}
        />
      )}

      <CharacterGuide character={LUKORIANS.tv} steps={GUIDE_STEPS} storageKey="tv-intro" />
    </StudentLayout>
  );
}
