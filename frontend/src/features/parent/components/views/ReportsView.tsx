import { useState } from 'react';
import { HiOutlineClock, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import type { ChildReport } from '../../types';
import { Card, SectionTitle } from '../shell/Card';
import styles from './ReportsView.module.css';

interface Props {
  report: ChildReport;
}

const PREVIEW = 6;

/** ثانیه‌ی خام برای والد بی‌معناست؛ بالای یک دقیقه به شکلِ ۸:۴۹ نشان داده می‌شود */
function duration(seconds: number): string {
  if (seconds < 60) return `${seconds.toLocaleString('fa-IR')} ثانیه`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes.toLocaleString('fa-IR')}:${rest.toString().padStart(2, '0').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}`;
}

function accuracyClass(value: number) {
  if (value >= 85) return styles.accHi;
  if (value >= 70) return styles.accMid;
  return styles.accLow;
}

/** گزارش‌ها — جلسه‌های اخیر و آمارِ ریزِ هر بازی */
export function ReportsView({ report }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sessions = expanded ? report.sessions : report.sessions.slice(0, PREVIEW);
  const rest = report.sessions.length - PREVIEW;

  return (
    <>
      <SectionTitle>جلسه‌ها</SectionTitle>
      <Card
        icon={HiOutlineClock}
        title="جلسه‌های اخیر"
        note="هر ردیف یک جلسهٔ بازی است با زمان و دقت آن."
        flush
      >
        {report.sessions.length === 0 ? (
          <p className={styles.empty}>هنوز جلسهٔ بازی‌ای ثبت نشده است.</p>
        ) : (
          <>
            {sessions.map((session) => (
              <div key={session.id} className={styles.row}>
                <span className={styles.rowIcon} aria-hidden>
                  <HiOutlineClock />
                </span>
                <div className={styles.rowMain}>
                  <b>{session.game}</b>
                  <small>
                    {session.at} · {session.time}
                  </small>
                </div>
                <div className={styles.rowSide}>
                  <span>{session.minutes.toLocaleString('fa-IR')} دقیقه</span>
                  <em className={accuracyClass(session.accuracy)}>
                    دقت {session.accuracy.toLocaleString('fa-IR')}٪
                  </em>
                </div>
              </div>
            ))}

            {rest > 0 && (
              <button
                type="button"
                className={styles.expand}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? 'بستن فهرست' : `نمایش ${rest.toLocaleString('fa-IR')} جلسهٔ دیگر`}
              </button>
            )}
          </>
        )}
      </Card>

      <SectionTitle>بازی‌ها</SectionTitle>
      <Card
        icon={HiOutlinePuzzlePiece}
        title="بازی‌های اخیر"
        note="آمار ریز هر بازی؛ از دقت و تلاش تا راهنمایی‌هایی که گرفته."
      >
        {report.games.length === 0 ? (
          <p className={styles.empty}>هنوز هیچ بازی‌ای انجام نشده است.</p>
        ) : (
          report.games.map((game) => (
            <div key={game.id} className={styles.game}>
              <div className={styles.gameTop}>
                <b>{game.title}</b>
                {game.book && <span className={styles.chipPlain}>{game.book}</span>}
              </div>
              <div className={styles.gameGrid}>
                <div>
                  <small>دقت</small>
                  <b>{game.accuracy.toLocaleString('fa-IR')}٪</b>
                  <span className={styles.gameBar}>
                    <i style={{ width: `${game.accuracy}%` }} />
                  </span>
                </div>
                <div>
                  <small>بهترین امتیاز</small>
                  <b>{game.bestScore.toLocaleString('fa-IR')}</b>
                </div>
                <div>
                  <small>تلاش</small>
                  <b>{game.attempts.toLocaleString('fa-IR')}</b>
                </div>
                <div>
                  <small>میانگین هر دور</small>
                  <b>{duration(game.avgSeconds)}</b>
                </div>
                <div>
                  <small>مجموع زمان</small>
                  <b>{game.totalMinutes.toLocaleString('fa-IR')} دقیقه</b>
                </div>
                <div>
                  <small>راهنمایی</small>
                  <b>{game.hints.toLocaleString('fa-IR')}</b>
                </div>
              </div>
              <p className={styles.gameFoot}>آخرین بازی: {game.lastPlayedAt}</p>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
