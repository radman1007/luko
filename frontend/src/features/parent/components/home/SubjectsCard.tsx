import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineCalculator,
  HiOutlineLanguage,
  HiOutlineLockClosed,
  HiOutlinePaintBrush,
  HiOutlinePencilSquare,
  HiOutlineSquares2X2,
} from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import type { SubjectProgressItem } from '../../types';
import styles from './SubjectsCard.module.css';

interface Props {
  subjects: SubjectProgressItem[];
  childName: string;
  onUpgrade: () => void;
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** آیکون و رنگِ هر درس — همان درس‌های کتاب (apps/games/naming.py) */
const SUBJECT_LOOK: Record<string, { icon: Icon; tone: string }> = {
  ریاضی: { icon: HiOutlineCalculator, tone: 'teal' },
  علوم: { icon: HiOutlineBeaker, tone: 'green' },
  قرآن: { icon: HiOutlineBookOpen, tone: 'amber' },
  نگارش: { icon: HiOutlinePencilSquare, tone: 'violet' },
  فارسی: { icon: HiOutlineLanguage, tone: 'blue' },
  هنر: { icon: HiOutlinePaintBrush, tone: 'rose' },
};

const fa = (value: number) => value.toLocaleString('fa-IR');

function status(subject: SubjectProgressItem): { label: string; tone: string } {
  if (subject.mastery === 0 && subject.gamesDone === 0) return { label: 'هنوز شروع نشده', tone: 'idle' };
  if (subject.mastery >= 80) return { label: 'عالی', tone: 'great' };
  if (subject.mastery >= 60) return { label: 'خوب', tone: 'good' };
  return { label: 'نیاز به تمرین', tone: 'work' };
}

/** کاشیِ کوچکِ درسی که آماری ندارد: شروع‌نشده یا قفل (بی‌اشتراک) */
function MiniTile({ subject, locked }: { subject: SubjectProgressItem; locked: boolean }) {
  const look = SUBJECT_LOOK[subject.label] ?? { icon: HiOutlineSquares2X2, tone: 'teal' };
  const Icon = look.icon;
  return (
    <li className={styles.tile} data-tone={look.tone} data-locked={locked || undefined}>
      <span className={styles.tileIcon} aria-hidden><Icon /></span>
      <span className={styles.tileText}>
        <b>{subject.label}</b>
        <small>{locked ? `${fa(subject.gamesTotal)} بازی` : `شروع نشده · ${fa(subject.gamesTotal)} بازی`}</small>
      </span>
      {locked && <HiOutlineLockClosed className={styles.tileLock} aria-label="قفل" />}
    </li>
  );
}

/**
 * وضعیتِ درس‌ها — درس‌های شروع‌شده با میله‌ی پیشرفت، بقیه کاشیِ کوچک تا کارت شلوغ نشود.
 * بی‌اشتراک فقط ریاضی باز است و بقیه قفل (سرور داده‌شان را نمی‌فرستد).
 */
export function SubjectsCard({ subjects, childName, onUpgrade }: Props) {
  const real = subjects.filter((subject) => subject.label !== 'عمومی');
  const open = real.filter((subject) => !subject.locked).sort((a, b) => b.mastery - a.mastery);
  const started = open.filter((subject) => subject.gamesDone > 0 || subject.mastery > 0);
  // دست‌کم یک ردیف تا «هنوز شروع نشده» با میله‌اش دیده شود
  const rows = started.length ? started : open.slice(0, 1);
  const idle = open.filter((subject) => !rows.includes(subject));
  const locked = real.filter((subject) => subject.locked);
  const waiting = locked.reduce((sum, subject) => sum + subject.gamesTotal, 0);

  return (
    <section className={styles.card} aria-labelledby="subjects-title">
      <header className={styles.head}>
        <div>
          <h2 id="subjects-title">وضعیتِ درس‌ها</h2>
          <p>پیشرفتِ {childName} در هر درس، از روی بازی‌هایی که انجام داده</p>
        </div>
      </header>

      {real.length === 0 ? (
        <p className={styles.empty}>هنوز درسی برای پایه‌ی {childName} ثبت نشده است.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((subject) => {
            const look = SUBJECT_LOOK[subject.label] ?? { icon: HiOutlineSquares2X2, tone: 'teal' };
            const Icon = look.icon;
            const state = status(subject);
            return (
              <li key={subject.key} className={styles.row} data-tone={look.tone}>
                <span className={styles.icon} aria-hidden><Icon /></span>
                <div className={styles.main}>
                  <div className={styles.line}>
                    <b>{subject.label}</b>
                    <span className={styles.state} data-state={state.tone}>{state.label}</span>
                  </div>
                  <div className={styles.track} role="img" aria-label={`تسلط ${fa(subject.mastery)} درصد`}>
                    <i style={{ width: `${Math.max(subject.mastery, subject.gamesDone ? 4 : 0)}%` }} />
                  </div>
                  <small className={styles.meta}>
                    {fa(subject.gamesDone)} از {fa(subject.gamesTotal)} بازی
                    {subject.mastery > 0 && <> · تسلط {fa(subject.mastery)}٪</>}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {idle.length + locked.length > 0 && (
        <ul className={styles.tiles}>
          {idle.map((subject) => <MiniTile key={subject.key} subject={subject} locked={false} />)}
          {locked.map((subject) => <MiniTile key={subject.key} subject={subject} locked />)}
        </ul>
      )}

      {locked.length > 0 && (
        <button type="button" className={styles.upsell} onClick={onUpgrade}>
          <span className={styles.crown} aria-hidden><CrownIcon size={18} strokeWidth={2} /></span>
          <span className={styles.upsellText}>
            <b>{fa(locked.length)} درسِ دیگر با اشتراک باز می‌شود</b>
            <small>
              {waiting > 0 ? `${fa(waiting)} بازیِ آماده؛ ` : ''}پیشرفتِ {childName} در همه‌ی درس‌ها را ببینید
            </small>
          </span>
          <span className={styles.upsellCta}>باز کردن</span>
        </button>
      )}
    </section>
  );
}
