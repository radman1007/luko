import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '@/lib/api';
import { useStorageChange } from '@/lib/useStorageChange';
import { podcastApi } from './api';
import { podcastKeys } from './usePodcasts';
import type { PodcastEpisode } from './types';

const LISTENED_KEY = 'luko_podcast_listened';

function loadListened(): string[] {
  try {
    const raw = localStorage.getItem(LISTENED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* داده‌ی خراب → لیست خالی */
  }
  return [];
}

function saveListened(ids: string[]) {
  try {
    localStorage.setItem(LISTENED_KEY, JSON.stringify(ids));
  } catch {
    /* حافظه پر یا بسته — تیکِ سرور هنوز هست */
  }
}

/** تیکِ سبز: هرچه سرور گفته + هرچه روی همین دستگاه (یا دستگاهِ هم‌رسانِ همین حساب) تمام شده */
export function mergeListened(episodes: PodcastEpisode[], local: string[]): string[] {
  const ids = new Set(local);
  for (const e of episodes) if (e.listened) ids.add(e.id);
  return [...ids];
}

function playbackError(): string {
  return typeof navigator !== 'undefined' && !navigator.onLine
    ? 'اینترنت وصل نیست؛ برای شنیدنِ پادکست اینترنت لازم است.'
    : 'این قسمت پخش نشد؛ کمی بعد دوباره امتحان کن.';
}

const isListenedKey = (key: string) => key === LISTENED_KEY;

/**
 * پخش‌کننده‌ی واقعی با یک `<audio>` برای هر صفحه. فایل فقط با زدنِ «پخش» گرفته
 * می‌شود (نه با بازشدنِ صفحه) تا اینترنتِ گوشیِ بچه بی‌دلیل مصرف نشود. قسمتی که تا
 * آخر شنیده شود تیک می‌خورد و برای بچه‌ی واردشده در سرور هم ثبت می‌شود.
 */
export function usePlayer(episodes: PodcastEpisode[]) {
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** قسمتی که فایلش الان در `<audio>` است */
  const loadedRef = useRef<PodcastEpisode | null>(null);
  const [currentId, setCurrentId] = useState('');
  /** همان loadedRef برای رندر (ref در رندر خوانده نمی‌شود) */
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [localListened, setLocalListened] = useState<string[]>(loadListened);
  // قسمتی که روی دستگاهِ دیگرِ همین حساب گوش داده شده
  useStorageChange(isListenedKey, useCallback(() => setLocalListened(loadListened()), []));

  const current: PodcastEpisode | undefined = episodes.find((e) => e.id === currentId) ?? episodes[0];

  const getAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'none';
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const finished = useCallback(
    (episode: PodcastEpisode, seconds: number) => {
      setLocalListened((ids) => {
        if (ids.includes(episode.id)) return ids;
        const next = [...ids, episode.id];
        saveListened(next);
        return next;
      });
      // مهمان حسابی در سرور ندارد؛ تیکش فقط روی همین دستگاه است
      if (!tokenStorage.get('kid')) return;
      podcastApi
        .listen(episode.id, seconds)
        .then(() => queryClient.invalidateQueries({ queryKey: podcastKeys.all }))
        .catch(() => {
          /* تیکِ محلی هست؛ دفعه‌ی بعد که تا آخر بشنود دوباره ثبت می‌شود */
        });
    },
    [queryClient],
  );

  // رویدادهای `<audio>` یک بار وصل می‌شوند؛ با ترکِ صفحه پخش می‌ایستد و فایل رها می‌شود
  useEffect(() => {
    const audio = getAudio();
    const onTime = () => setElapsed(Math.floor(audio.currentTime));
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(Math.round(audio.duration));
    };
    const onPlaying = () => {
      setPlaying(true);
      setBuffering(false);
      setError(null);
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onEnded = () => {
      setPlaying(false);
      setBuffering(false);
      const episode = loadedRef.current;
      if (episode) finished(episode, Math.round(audio.duration || audio.currentTime || 0));
    };
    const onError = () => {
      // بی‌src (رهاکردنِ فایل) هم error می‌دهد؛ آن خطا نیست
      if (!audio.getAttribute('src')) return;
      setPlaying(false);
      setBuffering(false);
      setError(playbackError());
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      loadedRef.current = null;
      setLoadedId(null);
    };
  }, [getAudio, finished]);

  /** باید همان لحظه‌ی ضربه صدا زده شود — سافاری پخشِ بی‌لمس را نمی‌پذیرد */
  const start = useCallback(
    (episode: PodcastEpisode) => {
      if (!episode.audioUrl) return;
      const audio = getAudio();
      if (loadedRef.current?.id !== episode.id) {
        loadedRef.current = episode;
        setLoadedId(episode.id);
        audio.src = episode.audioUrl;
        setElapsed(0);
        setDuration(episode.durationMinutes * 60);
      } else if (audio.ended) {
        audio.currentTime = 0;
      }
      setError(null);
      setBuffering(true);
      audio.play().catch((e: unknown) => {
        // قطعِ play با عوض‌شدنِ قسمت (AbortError) خطا نیست؛ خطای فایل را رویدادِ error می‌گوید
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setBuffering(false);
        if (e instanceof DOMException && e.name === 'NotAllowedError') return;
        if (!audio.error) setError(playbackError());
      });
    },
    [getAudio],
  );

  const toggle = useCallback(() => {
    if (!current) return;
    const audio = getAudio();
    if (loadedRef.current?.id === current.id && !audio.paused) {
      audio.pause();
      return;
    }
    start(current);
  }, [current, getAudio, start]);

  const select = useCallback(
    (id: string) => {
      const episode = episodes.find((e) => e.id === id);
      if (!episode) return;
      if (episode.id === current?.id && loadedRef.current?.id === id) {
        toggle();
        return;
      }
      setCurrentId(id);
      start(episode);
    },
    [episodes, current, toggle, start],
  );

  /** جلو/عقب بردن، بینِ ۰ و ۱ — فقط وقتی فایلِ همین قسمت آمده */
  const seek = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      if (!audio || !current || loadedRef.current?.id !== current.id) return;
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      if (total <= 0) return;
      audio.currentTime = Math.min(total, Math.max(0, ratio * total));
      setElapsed(Math.floor(audio.currentTime));
    },
    [current, duration],
  );

  const isLoaded = Boolean(current && loadedId === current.id);
  const shownDuration = isLoaded ? duration : (current?.durationMinutes ?? 0) * 60;
  const shownElapsed = isLoaded ? elapsed : 0;
  const progress = shownDuration > 0 ? Math.min(1, shownElapsed / shownDuration) : 0;

  return {
    current,
    playing: isLoaded && playing,
    buffering: isLoaded && buffering,
    error: isLoaded ? error : null,
    elapsed: shownElapsed,
    duration: shownDuration,
    progress,
    listened: mergeListened(episodes, localListened),
    toggle,
    select,
    seek,
  };
}
