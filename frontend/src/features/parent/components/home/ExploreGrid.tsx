import type { ComponentType, SVGProps } from 'react';
import { HiOutlineAcademicCap, HiOutlineChevronLeft, HiOutlineHeart, HiOutlineSparkles } from 'react-icons/hi2';
import type { MoodVariant } from '@/components/ui/icons';
import type { PanelPage } from '../layout/nav';
import styles from './ExploreGrid.module.css';

interface Props {
  childName: string;
  wellbeing?: { checkins: number; dominantMood: MoodVariant };
  onNavigate: (page: PanelPage) => void;
}

const MOOD_TEXT: Record<MoodVariant, string> = {
  happy: 'خوشحال', calm: 'آرام', tired: 'خسته', sad: 'ناراحت', angry: 'عصبانی',
};

interface Tile {
  page: PanelPage;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: string;
  title: string;
  text: string;
  soon?: boolean;
}

/** معرفیِ کوتاهِ بخش‌های دیگرِ پنل، هرکدام با یک جمله‌ی به‌دردبخور */
export function ExploreGrid({ childName, wellbeing, onNavigate }: Props) {
  const health = wellbeing && wellbeing.checkins > 0
    ? `این دو هفته ${wellbeing.checkins.toLocaleString('fa-IR')} بار حالش را ثبت کرده؛ بیشتر «${MOOD_TEXT[wellbeing.dominantMood]}» بوده.`
    : `حال‌ودلِ روزانه، تمرین‌های تنفس و نقاشی‌های ${childName} را این‌جا ببینید.`;
  const tiles: Tile[] = [
    { page: 'health', icon: HiOutlineHeart, tone: 'rose', title: 'سلامت و حال‌ودل', text: health },
    { page: 'assistant', icon: HiOutlineSparkles, tone: 'violet', title: 'دستیارِ هوشمند',
      text: `هر سؤالی درباره‌ی یادگیریِ ${childName} دارید بپرسید و جوابِ شخصی بگیرید.`, soon: true },
    { page: 'learn', icon: HiOutlineAcademicCap, tone: 'amber', title: 'آموزشِ والدین',
      text: 'نکته‌های کوتاه و کاربردی برای همراهیِ فرزند در یادگیری و تشویقِ درست.' },
  ];

  return (
    <section className={styles.wrap} aria-label="بخش‌های دیگرِ پنل">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <button key={tile.page} type="button" className={styles.tile} data-tone={tile.tone}
            onClick={() => onNavigate(tile.page)}>
            <span className={styles.icon} aria-hidden><Icon /></span>
            <span className={styles.text}>
              <b>{tile.title}{tile.soon && <em>به‌زودی</em>}</b>
              <small>{tile.text}</small>
            </span>
            <HiOutlineChevronLeft className={styles.arrow} aria-hidden />
          </button>
        );
      })}
    </section>
  );
}
