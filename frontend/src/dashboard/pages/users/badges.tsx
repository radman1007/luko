import { HiOutlineComputerDesktop, HiOutlineDevicePhoneMobile } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import type { Tone } from '../../components/Badge/Badge';
import type { LastSeen, SubInfo, UserRow } from '../../types';
import { faNum } from '../../lib/format';
import styles from '../Pages.module.css';

const SUB_TONE: Record<SubInfo['status'], Tone> = { active: 'green', renewal: 'amber', inactive: 'gray' };

export function SubBadge({ sub }: { sub: SubInfo }) {
  const days = sub.status !== 'inactive' && sub.daysLeft > 0 ? ` · ${faNum(sub.daysLeft)} روز`
    : sub.status === 'renewal' && sub.expired ? ' · تمام شده' : '';
  return <Badge tone={SUB_TONE[sub.status]} dot title={sub.endsFa ? `پایان: ${sub.endsFa}` : undefined}>{sub.label}{days}</Badge>;
}

const ROLE_TONE: Record<UserRow['role'], Tone> = {
  admin: 'red', staff: 'violet', parent: 'blue', student: 'teal', teacher: 'gray', school_admin: 'gray',
};

export function RoleBadge({ role, label }: { role: UserRow['role']; label: string }) {
  return <Badge tone={ROLE_TONE[role] ?? 'gray'}>{label}</Badge>;
}

export function SeenCell({ seen }: { seen: LastSeen }) {
  const Icon = seen.platform === 'android' ? HiOutlineDevicePhoneMobile : HiOutlineComputerDesktop;
  return (
    <span className={styles.inline} title={seen.estimated ? 'آخرین ورود (پیش از ثبتِ بازدیدها)' : undefined}>
      {seen.online ? <Badge tone="green" dot>آنلاین</Badge> : <span>{seen.fa}{seen.estimated ? '*' : ''}</span>}
      {seen.platform && <Icon aria-label={seen.platformLabel} />}
    </span>
  );
}

export function ChildrenSummary({ summary }: { summary: NonNullable<UserRow['children']> }) {
  const children = summary;
  if (!children.count) return <span className={styles.muted}>بی‌فرزند</span>;
  return (
    <span className={styles.inline}>
      {children.active > 0 && <Badge tone="green">{faNum(children.active)} فعال</Badge>}
      {children.renewal > 0 && <Badge tone="amber">{faNum(children.renewal)} تمدید</Badge>}
      {children.inactive > 0 && <Badge tone="gray">{faNum(children.inactive)} غیرفعال</Badge>}
    </span>
  );
}
