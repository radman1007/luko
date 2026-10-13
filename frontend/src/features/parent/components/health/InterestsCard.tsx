import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineAcademicCap,
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineFilm,
  HiOutlineMusicalNote,
  HiOutlinePaintBrush,
  HiOutlineStar,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import type { HealthDaily, InterestKind } from '../../types';
import { BreathIcon } from '../home/BreathIcon';
import { CardHead } from './CardHead';
import card from './card.module.css';
import styles from './InterestsCard.module.css';

interface Props {
  daily: HealthDaily;
  childName: string;
}

const KIND: Record<InterestKind, { icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }> = {
  subject: { icon: HiOutlineAcademicCap, tone: 'teal' },
  story: { icon: HiOutlineBookOpen, tone: 'amber' },
  music: { icon: HiOutlineMusicalNote, tone: 'violet' },
  science: { icon: HiOutlineBeaker, tone: 'green' },
  video: { icon: HiOutlineFilm, tone: 'blue' },
  art: { icon: HiOutlinePaintBrush, tone: 'rose' },
  sport: { icon: HiOutlineTrophy, tone: 'amber' },
  calm: { icon: BreathIcon, tone: 'green' },
};

/** علاقه‌ها: چیزهایی که خودش سراغشان می‌رود، هر کدام با عددِ پشتش */
export function InterestsCard({ daily, childName }: Props) {
  const { interests, favoriteColor } = daily;
  return (
    <section className={card.card} aria-labelledby="interests-title">
      <CardHead id="interests-title" icon={HiOutlineStar} tone="violet" title={`علاقه‌های ${childName}`}
        note="چیزهایی که خودش سراغشان می‌رود و جذبشان می‌شود" />

      {interests.length === 0 ? (
        <p className={card.empty}>
          هنوز علاقه‌ی روشنی پیدا نشده است. با بازی‌ها، قصه‌ها، نقاشی‌ها و مأموریت‌های بیشتر این‌جا پر می‌شود.
        </p>
      ) : (
        <ul className={styles.list}>
          {interests.map((item, index) => {
            const look = KIND[item.kind] ?? KIND.subject;
            const Icon = look.icon;
            return (
              <li key={item.key} className={styles.item} data-tone={look.tone}>
                <span className={styles.icon} aria-hidden><Icon /></span>
                <span className={styles.text}>
                  <b>{item.label}{index === 0 && <em>بیشترین</em>}</b>
                  <small>{item.detail}</small>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {favoriteColor && (
        <p className={styles.color}>
          <span className={styles.swatch} style={{ background: favoriteColor.color }} aria-hidden />
          رنگِ محبوبش در نقاشی: <b>{favoriteColor.label}</b>
        </p>
      )}
    </section>
  );
}
