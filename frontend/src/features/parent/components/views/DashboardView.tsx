import { useEffect, useRef, useState } from 'react';
import type { ComponentType, CSSProperties, SVGProps } from 'react';
import {
  HiOutlineBolt,
  HiOutlineChartBarSquare,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineFire,
  HiOutlineLightBulb,
  HiOutlineListBullet,
  HiOutlinePresentationChartLine,
  HiOutlinePuzzlePiece,
  HiOutlineSquares2X2,
  HiOutlineArrowTrendingDown,
  HiOutlineArrowTrendingUp,
  HiOutlineMinusSmall,
} from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import type { ChildAnalysis } from '../../analysis';
import type { ChildReport, Kpi } from '../../types';
import { Card } from '../shell/Card';
import { WeekChart } from '../charts/WeekChart';
import { TrendChart } from '../charts/TrendChart';
import { HoursChart } from '../charts/HoursChart';
import { ConceptLearningCard } from './ConceptLearningCard';
import styles from './DashboardView.module.css';

interface Props {
  report: ChildReport;
  analysis: ChildAnalysis;
  childName: string;
  onGoDaily: () => void;
}

type TileIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const KPI_ICON: Record<string, TileIcon> = {
  minutes: HiOutlineClock,
  games: HiOutlinePuzzlePiece,
  accuracy: HiOutlineCheckCircle,
  streak: HiOutlineFire,
  session: HiOutlineBolt,
  coins: CoinIcon,
};

/** عددها با شمارشِ نرم بالا می‌روند — همان حسِ اپِ نیتیو */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return undefined;
    }
    let start: number | null = null;
    const step = (time: number) => {
      if (start === null) start = time;
      const progress = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

function StatTile({ kpi }: { kpi: Kpi }) {
  const Icon = KPI_ICON[kpi.key] ?? HiOutlineSquares2X2;
  const value = useCountUp(kpi.value);
  const delta = kpi.delta ?? 0;
  const good = kpi.higherIsBetter === false ? delta < 0 : delta > 0;
  const DeltaIcon = delta === 0 ? HiOutlineMinusSmall : good ? HiOutlineArrowTrendingUp : HiOutlineArrowTrendingDown;

  return (
    <div className={styles.stat}>
      <div className={styles.statTop}>
        <Icon aria-hidden />
        <span>{kpi.label}</span>
      </div>
      <div className={styles.statValue}>
        <b>{value.toLocaleString('fa-IR')}</b>
        {kpi.unit && <span className={styles.unit}>{kpi.unit}</span>}
      </div>
      <div className={delta === 0 ? styles.deltaFlat : good ? styles.deltaUp : styles.deltaDown}>
        <DeltaIcon aria-hidden />
        <span>
          {delta === 0
            ? 'بدون تغییر'
            : `${Math.abs(delta).toLocaleString('fa-IR')}٪ ${delta > 0 ? 'بیشتر' : 'کمتر'} از هفتهٔ قبل`}
        </span>
      </div>
    </div>
  );
}

/** داشبورد — نتیجه‌گیریِ هفته، عددهای کلیدی و نمودارها */
export function DashboardView({ report, analysis, childName, onGoDaily }: Props) {
  const action = analysis.action;
  const subject = report.subjects.find((item) => item.mastery > 0 || item.gamesDone > 0);
  const untouched = report.subjects.filter((item) => item.mastery === 0 && item.gamesDone === 0);
  const strengths = report.topics.filter((topic) => topic.accuracy >= 70).slice(0, 3);
  const weak = report.topics.filter((topic) => topic.accuracy < 70).slice(0, 3);

  return (
    <>
      {/* بنرِ کاری که این هفته باید انجام شود */}
      {action && (
        <button type="button" className={styles.banner} onClick={onGoDaily}>
          <span className={styles.bannerIcon} aria-hidden>
            <HiOutlineLightBulb />
          </span>
          <span>
            <b>{action.title}</b>
            <span className={styles.bannerText}>{action.body}</span>
          </span>
        </button>
      )}

      {/* نمره‌ی هفته */}
      <Card
        icon={HiOutlinePresentationChartLine}
        title="تحلیل هفته"
        note={
          analysis.sampleSize > 0
            ? `ساخته‌شده از ${analysis.sampleSize.toLocaleString('fa-IR')} پاسخ ثبت‌شده در هفت روز گذشته`
            : 'در هفت روز گذشته پاسخی ثبت نشده است'
        }
      >
        <div className={styles.scoreRow}>
          <div className={styles.ring} style={{ '--v': `${analysis.score}%` } as CSSProperties}>
            <span className={styles.ringInner}>
              <b>{analysis.score.toLocaleString('fa-IR')}</b>
              <small>از ۱۰۰</small>
            </span>
          </div>
          <div className={styles.scoreTexts}>
            <span className={styles[`verdict_${analysis.verdict}`]}>{analysis.verdictLabel}</span>
            <b className={styles.headline}>{analysis.headline}</b>
            <p className={styles.narrative}>{analysis.narrative}</p>
          </div>
        </div>

        <div className={styles.parts}>
          {analysis.parts.map((part) => (
            <div key={part.key} className={styles.part}>
              <div className={styles.partTop}>
                <span>{part.label}</span>
                <b>{part.value.toLocaleString('fa-IR')}٪</b>
              </div>
              <div className={styles.partTrack}>
                <i
                  className={part.value >= 60 ? styles.partFillGood : styles.partFillWeak}
                  style={{ width: `${part.value}%` }}
                />
              </div>
              <small>{part.detail}</small>
            </div>
          ))}
        </div>

        {analysis.findings.length > 0 && (
          <ul className={styles.findings}>
            {analysis.findings.map((finding) => (
              <li key={finding.id} className={styles[`finding_${finding.tone}`]}>
                <span className={styles.findingIcon} aria-hidden>
                  {finding.tone === 'good' ? (
                    <HiOutlineCheckCircle />
                  ) : finding.tone === 'watch' ? (
                    <HiOutlineExclamationTriangle />
                  ) : (
                    <HiOutlineLightBulb />
                  )}
                </span>
                <span>
                  <b>{finding.title}</b>
                  <small>{finding.body}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className={styles.grid2}>
        {report.kpis.map((kpi) => (
          <StatTile key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <Card
        icon={HiOutlineChartBarSquare}
        title="زمان فعالیت روزانه"
        note="هر ستون یک روز است؛ عدد بالای ستون، دقیقه‌های همان روز."
      >
        <WeekChart week={report.week} />
      </Card>

      <Card
        icon={HiOutlinePresentationChartLine}
        title="روند دقت پاسخ‌ها"
        note="درصد پاسخ‌های درست در هشت هفتهٔ گذشته."
      >
        <TrendChart points={report.accuracyTrend} />
      </Card>

      <Card
        icon={HiOutlineSquares2X2}
        title="تسلط در درس‌ها"
        note="بر اساس دقت پاسخ‌ها و تعداد بازی‌های کامل‌شدهٔ هر درس."
      >
        {subject ? (
          <>
            <div className={styles.mRow}>
              <b>{subject.label}</b>
              <span className={styles.mPct}>
                {subject.mastery.toLocaleString('fa-IR')}
                <small>٪</small>
              </span>
            </div>
            <div className={styles.mTrack}>
              <i style={{ width: `${subject.mastery}%` }} />
            </div>
            <div className={styles.mMeta}>
              <span className={subject.mastery >= 70 ? styles.chipGood : styles.chipWarn}>
                {subject.mastery >= 70 ? 'خوب' : 'نیاز به تمرین'}
              </span>
              <span>
                {subject.gamesDone.toLocaleString('fa-IR')} از{' '}
                {subject.gamesTotal.toLocaleString('fa-IR')} بازی
              </span>
              {subject.weakestTopic && (
                <span className={styles.chipWarn}>
                  <HiOutlineExclamationTriangle aria-hidden />
                  ضعیف‌ترین مبحث: {subject.weakestTopic}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className={styles.empty}>
            هنوز هیچ درسی شروع نشده است. با انتخابِ «بازی روز» اولین قدم را بردارید.
          </p>
        )}

        {untouched.length > 0 && (
          <p className={styles.mNote}>
            <b>{untouched.length.toLocaleString('fa-IR')} درس هنوز شروع نشده:</b>{' '}
            {untouched.map((item) => item.label).join('، ')} — روی این درس‌ها در مجموع{' '}
            {untouched.reduce((sum, item) => sum + item.gamesTotal, 0).toLocaleString('fa-IR')} بازی
            آمادهٔ شروع است.
          </p>
        )}
      </Card>

      <Card
        icon={HiOutlineListBullet}
        title="نقطهٔ قوت و ضعف"
        note="ریزتر از درس: مبحث‌های داخل بازی‌ها، روی همهٔ پاسخ‌های ثبت‌شده."
      >
        {report.topics.length === 0 ? (
          <p className={styles.empty}>
            بازی‌هایی که مبحثِ هر سؤال را گزارش می‌کنند هنوز انجام نشده‌اند.
          </p>
        ) : (
          <>
            {strengths.length > 0 && (
              <>
                <div className={styles.skHeadGood}>
                  <HiOutlineArrowTrendingUp aria-hidden />
                  نقطه‌های قوت
                </div>
                {strengths.map((topic) => (
                  <div key={topic.key} className={styles.skill}>
                    <div className={styles.sLine}>
                      <b>{topic.label}</b>
                      <span>{topic.accuracy.toLocaleString('fa-IR')}٪</span>
                    </div>
                    <div className={styles.sTrack}>
                      <i className={styles.sFillGood} style={{ width: `${topic.accuracy}%` }} />
                    </div>
                    <small className={styles.sMeta}>
                      {topic.asked.toLocaleString('fa-IR')} پاسخ ·{' '}
                      {topic.avgSeconds.toLocaleString('fa-IR')} ثانیه
                    </small>
                  </div>
                ))}
              </>
            )}

            {weak.length > 0 && (
              <>
                {strengths.length > 0 && <div className={styles.skDiv} />}
                <div className={styles.skHeadBad}>
                  <HiOutlineArrowTrendingDown aria-hidden />
                  نیاز به تمرین
                </div>
                {weak.map((topic) => (
                  <div key={topic.key} className={styles.skill}>
                    <div className={styles.sLine}>
                      <b>{topic.label}</b>
                      <span>{topic.accuracy.toLocaleString('fa-IR')}٪</span>
                    </div>
                    <div className={styles.sTrack}>
                      <i className={styles.sFillWeak} style={{ width: `${topic.accuracy}%` }} />
                    </div>
                    <small className={styles.sMeta}>
                      {topic.asked.toLocaleString('fa-IR')} پاسخ ·{' '}
                      {topic.avgSeconds.toLocaleString('fa-IR')} ثانیه
                    </small>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </Card>

      <ConceptLearningCard learning={report.learning} />

      <Card
        icon={HiOutlineClock}
        title="ساعت‌های بازی در شبانه‌روز"
        note="نشان می‌دهد بازی نزدیک ساعت خواب انجام می‌شود یا نه."
      >
        <HoursChart hours={report.hourly} />
      </Card>

      <p className={styles.pageFoot}>
        نمرهٔ هفتهٔ {childName} از چهار بخش بالا ساخته می‌شود؛ هیچ عددی حدس نیست و همه از بازی‌های
        ثبت‌شده می‌آید.
      </p>
    </>
  );
}
