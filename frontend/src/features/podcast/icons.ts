import {
  HiOutlineBookOpen,
  HiOutlineBugAnt,
  HiOutlineCloud,
  HiOutlineGlobeAsiaAustralia,
  HiOutlineHeart,
  HiOutlineMicrophone,
  HiOutlineMoon,
  HiOutlineMusicalNote,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
  HiOutlineStar,
  HiOutlineSun,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';

/** همان نام‌هایی که ادمین از فهرستِ «آیکون» انتخاب می‌کند (Podcast.Icon در بک‌اند) */
const ICONS: Record<string, IconType> = {
  HiOutlineRocketLaunch,
  HiOutlineCloud,
  HiOutlineMoon,
  HiOutlineStar,
  HiOutlineSun,
  HiOutlineMusicalNote,
  HiOutlineBugAnt,
  HiOutlineGlobeAsiaAustralia,
  HiOutlineBookOpen,
  HiOutlineSparkles,
  HiOutlineHeart,
  HiOutlineMicrophone,
};

/** آیکون خالی ماند: آیکونِ دسته */
const CATEGORY_ICONS: Record<string, IconType> = {
  قصه: HiOutlineBookOpen,
  علمی: HiOutlineRocketLaunch,
  موسیقی: HiOutlineMusicalNote,
  خواب: HiOutlineMoon,
};

export function podcastIcon(name: string, category: string): IconType {
  return ICONS[name] ?? CATEGORY_ICONS[category] ?? HiOutlineMicrophone;
}
