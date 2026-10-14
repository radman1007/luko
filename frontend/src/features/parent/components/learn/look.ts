import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineCalendarDays,
  HiOutlineDevicePhoneMobile,
  HiOutlineDocumentText,
  HiOutlineFaceSmile,
  HiOutlineLightBulb,
  HiOutlineMicrophone,
  HiOutlineMoon,
  HiOutlinePlayCircle,
  HiOutlineUserGroup,
} from 'react-icons/hi2';
import type { LearnKind, LearnTopic } from '../../learnApi';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** رنگ و آیکونِ هر موضوع؛ کارتِ بی‌عکس با همین طرح ساخته می‌شود */
export const TOPIC_LOOK: Record<LearnTopic, { icon: Icon; from: string; to: string; ink: string }> = {
  learning: { icon: HiOutlineLightBulb, from: '#e3f3f1', to: '#c3e3df', ink: '#215e61' },
  habits: { icon: HiOutlineCalendarDays, from: '#fff5d9', to: '#ffe09c', ink: '#8a5200' },
  emotions: { icon: HiOutlineFaceSmile, from: '#fdeef3', to: '#f7cddb', ink: '#a8355d' },
  screen: { icon: HiOutlineDevicePhoneMobile, from: '#f1ecff', to: '#d9cdfa', ink: '#5b3fc4' },
  health: { icon: HiOutlineMoon, from: '#e6f5ee', to: '#c3e8d4', ink: '#1b7f58' },
  family: { icon: HiOutlineUserGroup, from: '#fff0e5', to: '#ffd4bb', ink: '#a8501b' },
};

interface KindLook {
  icon: Icon;
  label: string;
  plural: string;
  verb: string;
  unit: string;
  /** دکمه‌ی «تمام شد» و حالتِ زده‌شده‌اش */
  done: string;
  doneAlready: string;
}

export const KIND_LOOK: Record<LearnKind, KindLook> = {
  article: { icon: HiOutlineDocumentText, label: 'مقاله', plural: 'مقاله‌ها', verb: 'خواندن', unit: 'دقیقه مطالعه',
    done: 'خواندم', doneAlready: 'خوانده‌اید' },
  video: { icon: HiOutlinePlayCircle, label: 'ویدیو', plural: 'ویدیوها', verb: 'تماشا', unit: 'دقیقه',
    done: 'دیدم', doneAlready: 'دیده‌اید' },
  podcast: { icon: HiOutlineMicrophone, label: 'پادکست', plural: 'پادکست‌ها', verb: 'شنیدن', unit: 'دقیقه',
    done: 'شنیدم', doneAlready: 'شنیده‌اید' },
};

export const fa = (n: number) => n.toLocaleString('fa-IR');
