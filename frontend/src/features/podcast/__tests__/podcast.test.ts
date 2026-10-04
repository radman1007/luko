import { describe, expect, it } from 'vitest';
import { HiOutlineBookOpen, HiOutlineMicrophone, HiOutlineMoon, HiOutlineRocketLaunch } from 'react-icons/hi2';
import { podcastIcon } from '../icons';
import { mergeListened } from '../usePlayer';
import { toEpisode } from '../usePodcasts';
import type { PodcastDto } from '../types';

const dto = (over: Partial<PodcastDto> = {}): PodcastDto => ({
  id: 12,
  title: 'قصه‌ی ماه',
  category: 'قصه',
  durationMinutes: 7,
  icon: 'HiOutlineMoon',
  audioUrl: 'https://my.luko.ir/media/podcasts/2026/10/moon.mp3',
  listened: false,
  ...over,
});

describe('toEpisode', () => {
  it('پاسخِ سرور را به قسمتِ قابلِ پخش تبدیل می‌کند', () => {
    const e = toEpisode(dto());
    expect(e.id).toBe('12');
    expect(e.audioUrl).toBe('https://my.luko.ir/media/podcasts/2026/10/moon.mp3');
    expect(e.icon).toBe(HiOutlineMoon);
    expect(e.durationMinutes).toBe(7);
    expect(e.listened).toBe(false);
  });

  it('فیلدهای خالیِ ردیف‌های قدیمی را نمی‌شکند', () => {
    const e = toEpisode(dto({ icon: '', durationMinutes: 0, listened: true }));
    expect(e.icon).toBe(HiOutlineBookOpen); // آیکونِ دسته‌ی قصه
    expect(e.durationMinutes).toBe(0);
    expect(e.listened).toBe(true);
  });
});

describe('podcastIcon', () => {
  it('نامِ انتخاب‌شده در ادمین، وگرنه آیکونِ دسته، وگرنه میکروفون', () => {
    expect(podcastIcon('HiOutlineRocketLaunch', 'خواب')).toBe(HiOutlineRocketLaunch);
    expect(podcastIcon('', 'خواب')).toBe(HiOutlineMoon);
    expect(podcastIcon('HiOutlineNotAnIcon', 'دسته‌ی تازه')).toBe(HiOutlineMicrophone);
  });
});

describe('mergeListened', () => {
  it('تیکِ سرور و تیکِ همین دستگاه با هم، بی‌تکرار', () => {
    const episodes = [toEpisode(dto({ id: 1, listened: true })), toEpisode(dto({ id: 2 })), toEpisode(dto({ id: 3 }))];
    expect(mergeListened(episodes, ['3', '1']).sort()).toEqual(['1', '3']);
    expect(mergeListened(episodes, [])).toEqual(['1']);
  });
});
