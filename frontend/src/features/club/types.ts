import type { IconType } from 'react-icons';

export interface Mission {
  id: string;
  title: string;
  coinReward: number;
  icon: IconType;
}

export interface Medal {
  id: string;
  title: string;
  description: string;
  icon: IconType;
  unlocked: boolean;
}

export interface ShopItem {
  id: string;
  title: string;
  cost: number;
  icon: IconType;
}
