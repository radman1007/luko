/**
 * داده‌ی نمونه‌ی بخش‌های تنظیمات برای حالتِ مهمان (بی‌حساب، بی‌API).
 * همان شکلِ پاسخِ سرور تا صفحه‌ها برای مهمان شاخه‌ی جدا نخواهند.
 */
import type { Child, ParentNotification } from '../../types';
import type { ChildProfile, TicketDetail, TicketList } from '../../settingsTypes';

export function guestProfile(child: Child): ChildProfile {
  const first = child.id === 'guest-child-1';
  return {
    id: child.id,
    firstName: child.firstName,
    lastName: child.lastName,
    phone: first ? '09120000001' : '09120000002',
    phoneVerified: first,
    grade: child.grade,
    gradeLabel: `پایه‌ی ${['', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'][child.grade] ?? child.grade}`,
    school: child.school ?? '',
    relation: 'والد',
    joinedFa: first ? '۲ شهریور ۱۴۰۵' : '۱۹ شهریور ۱۴۰۵',
    joinedDays: first ? 49 : 32,
    linkedFa: first ? '۲ شهریور ۱۴۰۵' : '۱۹ شهریور ۱۴۰۵',
    lastSeenFa: child.lastActiveAt,
    platform: first ? 'android' : 'web',
    online: Boolean(child.online),
    stats: first
      ? { coins: 340, points: 1280, treasures: 4, gamesCompleted: 27, medals: 6, tasks: 41, streak: 3, paintings: 9, checkins: 58 }
      : { coins: 120, points: 410, treasures: 1, gamesCompleted: 8, medals: 2, tasks: 12, streak: 1, paintings: 3, checkins: 19 },
    subscription: { active: false, planTitle: 'رایگان', daysLeft: 0, endsFa: '' },
  };
}

const base = {
  priority: 'normal' as const,
  rating: null,
  closedFa: '',
  ratingComment: '',
};

export const GUEST_TICKET_DETAILS: TicketDetail[] = [
  {
    ...base,
    id: 1,
    code: 'LK-1001',
    subject: 'گزارشِ هفتگی دیر به‌روز می‌شود',
    category: 'reports',
    categoryLabel: 'گزارش‌ها و پنل',
    status: 'answered',
    statusLabel: 'پاسخ داده شده',
    childId: 'guest-child-1',
    childName: 'آرش رستمی',
    createdFa: 'دیروز، ۱۹:۱۰',
    lastFa: 'امروز، ۰۹:۴۰',
    preview: 'سلام، گزارش‌ها هر بار که آرش بازی را تمام کند تا یک دقیقه بعد به‌روز می‌شوند…',
    lastFromStaff: true,
    messages: 2,
    unread: 1,
    canReply: true,
    canClose: true,
    canRate: true,
    thread: [
      { id: 1, body: 'سلام. بازیِ امروزِ آرش را دیدم ولی هنوز در گزارش نیامده. مشکلی هست؟', fromStaff: false, sender: 'شما', atFa: 'دیروز، ۱۹:۱۰' },
      { id: 2, body: 'سلام، گزارش‌ها هر بار که آرش بازی را تمام کند تا یک دقیقه بعد به‌روز می‌شوند. اگر بازی نیمه‌کاره بسته شود، فقط پاسخ‌ها ثبت می‌شود. باز هم اگر نیامد همین‌جا بنویسید.', fromStaff: true, sender: 'پشتیبانی لوکو', atFa: 'امروز، ۰۹:۴۰' },
    ],
  },
  {
    ...base,
    id: 2,
    code: 'LK-1002',
    subject: 'پیشنهاد: بازی‌های بیشتر برای علوم',
    category: 'idea',
    categoryLabel: 'پیشنهاد و انتقاد',
    status: 'closed',
    statusLabel: 'بسته',
    childId: null,
    childName: '',
    createdFa: '۲۴ مهر، ۱۸:۰۲',
    lastFa: '۲۵ مهر، ۱۰:۱۵',
    preview: 'ممنون از پیشنهادتان؛ مجموعه‌ی تازه‌ی علوم در راه است.',
    lastFromStaff: true,
    messages: 2,
    unread: 0,
    rating: 5,
    closedFa: '۲۵ مهر، ۱۰:۲۰',
    canReply: false,
    canClose: false,
    canRate: false,
    thread: [
      { id: 3, body: 'بچه‌ها علوم را خیلی دوست دارند؛ کاش بازی‌های بیشتری داشت.', fromStaff: false, sender: 'شما', atFa: '۲۴ مهر، ۱۸:۰۲' },
      { id: 4, body: 'ممنون از پیشنهادتان؛ مجموعه‌ی تازه‌ی علوم در راه است.', fromStaff: true, sender: 'پشتیبانی لوکو', atFa: '۲۵ مهر، ۱۰:۱۵' },
    ],
  },
];

export const GUEST_TICKETS: TicketList = {
  // جزئیات همان خلاصه به‌علاوه‌ی گفت‌وگوست؛ فهرست فقط بخشِ خلاصه را می‌خواند
  items: GUEST_TICKET_DETAILS,
  counts: { all: 2, open: 0, answered: 1, closed: 1 },
  unread: 1,
  categories: [
    { key: 'account', label: 'حساب و ورود' },
    { key: 'billing', label: 'اشتراک و پرداخت' },
    { key: 'reports', label: 'گزارش‌ها و پنل' },
    { key: 'games', label: 'بازی‌ها و محتوا' },
    { key: 'technical', label: 'مشکلِ فنی' },
    { key: 'idea', label: 'پیشنهاد و انتقاد' },
    { key: 'other', label: 'سایر' },
  ],
  priority: false,
};

export const GUEST_NOTIFICATIONS: { items: ParentNotification[]; unread: number } = {
  unread: 2,
  items: [
    { id: 1, kind: 'weekly', title: 'گزارش هفتگی آرش آماده شد', body: 'خلاصه‌ی این هفته در خانه‌ی پنل آماده است.', link: '/parent-panel', isRead: false, childName: 'آرش', at: 'امروز، ۰۹:۰۰' },
    { id: 2, kind: 'support', title: 'پشتیبانی پاسخ داد', body: 'دربارهٔ «گزارشِ هفتگی دیر به‌روز می‌شود»', link: '/parent-panel?p=settings&s=ticket&id=1', isRead: false, childName: '', at: 'امروز، ۰۹:۴۰' },
    { id: 3, kind: 'games', title: 'آرش «الگویاب» را کامل کرد', body: 'جزئیاتِ دقت و زمانش در «گزارشِ کامل» هست.', link: '/parent-panel?p=details', isRead: true, childName: 'آرش', at: 'دیروز، ۱۷:۲۰' },
    { id: 4, kind: 'mood', title: 'ثبت حال نیکی: آروم', body: 'روند حال و روحیه را در بخشِ سلامت ببینید.', link: '/parent-panel?p=health', isRead: true, childName: 'نیکی', at: 'دیروز، ۱۶:۰۵' },
    { id: 5, kind: 'billing', title: 'پلن‌های اشتراک لوکو', body: 'با اشتراک، گزارشِ همه‌ی درس‌ها و حالِ روزانه باز می‌شود.', link: '/parent-panel?p=settings&s=billing', isRead: true, childName: '', at: '۲ روز پیش' },
  ],
};
