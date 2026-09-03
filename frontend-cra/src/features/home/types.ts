import type { IconType } from 'react-icons';

export interface BookPreview {
  id: string;
  title: string;
  subject: string;
  /** اسم دنیای بازی — کتاب در گیم‌زون با این اسم دیده می‌شود */
  worldTitle: string;
  icon: IconType;
  gamesCount: number;
}
