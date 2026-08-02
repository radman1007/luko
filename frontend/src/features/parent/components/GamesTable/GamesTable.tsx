import { useMemo, useState } from 'react';
import {
  HiOutlineArrowTrendingUp,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineMinusSmall,
} from 'react-icons/hi2';
import type { GameStat, GameStatus, SubjectKey } from '../../types';
import styles from './GamesTable.module.css';

interface Props {
  games: GameStat[];
  /** فقط چند ردیفِ اول (برای پیش‌نمایشِ داشبورد) */
  limit?: number;
  /** فیلترِ درس و مرتب‌سازی */
  filterable?: boolean;
}

const STATUS: Record<GameStatus, { text: string; cls: string; Icon: typeof HiOutlineCheckCircle }> = {
  mastered: { text: 'مسلط', cls: styles.chipGood, Icon: HiOutlineCheckCircle },
  progress: { text: 'در حال پیشرفت', cls: styles.chipProgress, Icon: HiOutlineArrowTrendingUp },
  struggling: { text: 'نیاز به کمک', cls: styles.chipRisk, Icon: HiOutlineExclamationTriangle },
  untouched: { text: 'بازی نشده', cls: styles.chipIdle, Icon: HiOutlineMinusSmall },
};

type SortKey = 'recent' | 'accuracy' | 'time' | 'attempts';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'آخرین بازی' },
  { key: 'accuracy', label: 'کمترین دقت' },
  { key: 'time', label: 'بیشترین زمان' },
  { key: 'attempts', label: 'بیشترین تلاش' },
];

/** ثانیه → «۳:۰۴» */
function mmss(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toLocaleString('fa-IR')}:${s.toString().padStart(2, '0').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}`;
}

function sortGames(games: GameStat[], key: SortKey): GameStat[] {
  const copy = [...games];
  if (key === 'accuracy') return copy.sort((a, b) => a.accuracy - b.accuracy);
  if (key === 'time') return copy.sort((a, b) => b.totalMinutes - a.totalMinutes);
  if (key === 'attempts') return copy.sort((a, b) => b.attempts - a.attempts);
  return copy;
}

/** آمارِ ریزِ تک‌تکِ بازی‌ها — قلبِ گزارشِ والدین */
export function GamesTable({ games, limit, filterable = false }: Props) {
  const [subject, setSubject] = useState<SubjectKey | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  const subjects = useMemo(() => {
    const seen = new Map<SubjectKey, string>();
    games.forEach((game) => seen.set(game.subject, game.subjectLabel));
    return [...seen.entries()];
  }, [games]);

  const rows = useMemo(() => {
    const filtered = subject === 'all' ? games : games.filter((game) => game.subject === subject);
    const sorted = sortGames(filtered, sort);
    return limit ? sorted.slice(0, limit) : sorted;
  }, [games, subject, sort, limit]);

  return (
    <div>
      {filterable && (
        <div className={styles.controls}>
          <div className={styles.chips}>
            <button
              type="button"
              className={subject === 'all' ? styles.filterActive : styles.filter}
              onClick={() => setSubject('all')}
            >
              همهٔ درس‌ها
            </button>
            {subjects.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={subject === key ? styles.filterActive : styles.filter}
                onClick={() => setSubject(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className={styles.sort}>
            مرتب‌سازی:
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.left}>بازی</th>
              <th>درس</th>
              <th>تلاش</th>
              <th>بهترین امتیاز</th>
              <th className={styles.accuracyCol}>دقت</th>
              <th>میانگین هر دور</th>
              <th>مجموع زمان</th>
              <th>راهنمایی</th>
              <th>آخرین بازی</th>
              <th>وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((game) => {
              const { text, cls, Icon } = STATUS[game.status];
              return (
                <tr key={game.id}>
                  <td className={styles.left}>
                    <b className={styles.gameTitle}>{game.title}</b>
                    <span className={styles.gameBook}>{game.book}</span>
                  </td>
                  <td>{game.subjectLabel}</td>
                  <td className={styles.num}>{game.attempts.toLocaleString('fa-IR')}</td>
                  <td className={styles.num}>{game.bestScore.toLocaleString('fa-IR')}</td>
                  <td>
                    <span className={styles.meter}>
                      <span className={styles.meterFill} style={{ width: `${game.accuracy}%` }} />
                    </span>
                    <span className={styles.meterValue}>{game.accuracy.toLocaleString('fa-IR')}٪</span>
                  </td>
                  <td className={styles.num}>{mmss(game.avgSeconds)}</td>
                  <td className={styles.num}>
                    {game.totalMinutes ? `${game.totalMinutes.toLocaleString('fa-IR')} دقیقه` : '—'}
                  </td>
                  <td className={styles.num}>{game.hints.toLocaleString('fa-IR')}</td>
                  <td className={styles.muted}>{game.lastPlayedAt}</td>
                  <td>
                    <span className={cls}>
                      <Icon size={13} aria-hidden />
                      {text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
