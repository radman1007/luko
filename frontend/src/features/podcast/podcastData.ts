// TODO: بعد از آماده شدن بک‌اند، قسمت‌ها از API می‌آیند (podcastService)
import {
  HiOutlineBugAnt,
  HiOutlineCloud,
  HiOutlineGlobeAsiaAustralia,
  HiOutlineMoon,
  HiOutlineMusicalNote,
  HiOutlineRocketLaunch,
  HiOutlineStar,
} from 'react-icons/hi2';
import type { PodcastEpisode } from './types';

/** قسمت اول لیست = «پادکست امروز» */
export const MOCK_EPISODES: PodcastEpisode[] = [
  { id: 'p1', title: 'سفر به فضا', category: 'علمی', durationMinutes: 8, icon: HiOutlineRocketLaunch },
  { id: 'p2', title: 'قصه‌ی جنگل بارونی', category: 'قصه', durationMinutes: 10, icon: HiOutlineCloud },
  { id: 'p3', title: 'لالایی ستاره‌ها', category: 'خواب', durationMinutes: 6, icon: HiOutlineMoon },
  { id: 'p4', title: 'آهنگای شاد صبح', category: 'موسیقی', durationMinutes: 5, icon: HiOutlineMusicalNote },
  { id: 'p5', title: 'راز دایناسورها', category: 'علمی', durationMinutes: 9, icon: HiOutlineBugAnt },
  { id: 'p6', title: 'قصه‌ی ماهی کوچولو', category: 'قصه', durationMinutes: 7, icon: HiOutlineGlobeAsiaAustralia },
  { id: 'p7', title: 'ترانه‌ی شب‌بخیر', category: 'خواب', durationMinutes: 4, icon: HiOutlineStar },
];
