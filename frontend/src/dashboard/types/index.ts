/** شکلِ پاسخ‌های API داشبورد (camelCase، همان که سرور می‌دهد) */

export type Capability =
  | 'stats' | 'users_view' | 'users_edit' | 'payments' | 'gifts' | 'tickets'
  | 'podcasts' | 'blog' | 'concepts' | 'notify' | 'audit';

export interface Me {
  id: number;
  name: string;
  phone: string;
  isSuperuser: boolean;
  title: string;
  capabilities: Capability[];
  idleMinutes: number;
}

export interface Option<V = string> {
  value: V;
  label: string;
}

export interface Meta {
  capabilities: { key: Capability; label: string; description: string }[];
  grades: Option<number>[];
  roles: Option[];
  subscriptionStatuses: Option[];
  lastSeen: Option[];
  plans: { code: string; title: string; days: number; priceToman: number }[];
  podcastIcons: Option[];
  podcastCategories: string[];
  auditActions: Option[];
  conceptSubjects: Option[];
}

export interface Paged<T> {
  results: T[];
  count: number;
  page: number;
  pages: number;
  pageSize: number;
}

export interface LastSeen {
  at: string | null;
  fa: string;
  platform: '' | 'web' | 'android';
  platformLabel: string;
  online: boolean;
  estimated: boolean;
}

export type SubStatus = 'active' | 'renewal' | 'inactive';

export interface SubInfo {
  status: SubStatus;
  label: string;
  endsFa: string;
  daysLeft: number;
  expired: boolean;
  plan?: string;
  totalDays?: number;
}

export interface UserRow {
  id: number;
  name: string;
  phone: string;
  role: 'student' | 'parent' | 'staff' | 'admin' | 'teacher' | 'school_admin';
  roleLabel: string;
  grade: number | null;
  gradeLabel: string;
  isActive: boolean;
  phoneVerified: boolean;
  joinedFa: string;
  lastSeen: LastSeen;
  subscription: SubInfo | null;
  children: { count: number; active: number; renewal: number; inactive: number } | null;
}

export interface PaymentRow {
  id: number;
  factor: string;
  childId: number | null;
  childName: string;
  payerId: number | null;
  payerPhone: string;
  planTitle: string;
  days: number;
  amountToman: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  statusLabel: string;
  source: 'gateway' | 'gift';
  grantedBy: string;
  note: string;
  createdFa: string;
  paidFa: string;
  endsFa: string;
  transId: string;
  message: string;
}

export interface UserDetail extends UserRow {
  firstName: string;
  lastName: string;
  joinedStamp: string;
  lastLoginFa: string;
  lastSeenStamp: string;
  activity: {
    minutes: number;
    webMinutes: number;
    androidMinutes: number;
    activeDays: number;
    series: { day: string; minutes: number }[];
  };
  parents: { id: number; name: string; phone: string }[];
  childrenList: { id: number; name: string; gradeLabel: string; subscription: SubInfo; lastSeen: LastSeen }[];
  payments: PaymentRow[];
  tickets: { id: number; subject: string; status: string; statusLabel: string; updatedFa: string }[];
  progress: {
    gamesDone: number;
    stars: number;
    lastGame: string;
    lastGameFa: string;
    coins: number;
    points: number;
    podcastListens: number;
  } | null;
  staff: { title: string; capabilities: Capability[] } | null;
  history: { action: string; by: string; at: string; details: Record<string, unknown> }[];
}

export interface Totals {
  visitors: number;
  minutes: number;
  avgMinutes: number;
}

export interface Online {
  web: number;
  android: number;
  total: number;
  users: number;
  guests: number;
}

export interface ActivePoint {
  label: string;
  visitors: number;
  minutes: number;
  avgMinutes: number;
  web: number;
  android: number;
}

export interface SignupPoint {
  label: string;
  students: number;
  parents: number;
}

export interface TicketRow {
  id: number;
  /** شماره‌ی پیگیری که والد می‌بیند: LK-1042 */
  code: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  statusLabel: string;
  category: string;
  categoryLabel: string;
  /** والدِ مشترک: high */
  priority: 'normal' | 'high';
  childName: string;
  /** امتیازِ والد به پاسخ (۱ تا ۵) */
  rating: number | null;
  ratingComment: string;
  userId: number;
  userName: string;
  userPhone: string;
  messages: number | null;
  lastAtFa: string;
  createdFa: string;
}

export interface Overview {
  users: { students: number; parents: number; staff: number; newToday: number; new7d: number };
  online: Online;
  active: { today: number; todayAvgMinutes: number; week: number; weekAvgMinutes: number };
  subscriptions: { active: number; expiring: number; monthLabel: string; monthSalesToman: number; monthPaid: number };
  tickets: { open: number; answered: number };
  series: { active: ActivePoint[]; signups: SignupPoint[] };
  latest: {
    signups?: UserRow[];
    payments?: PaymentRow[];
    tickets?: { id: number; subject: string; user: string; status: string; statusLabel: string }[];
  };
}

export interface Analytics {
  range: '24h' | '7d' | '30d' | '90d';
  online: Online;
  totals: Totals;
  byPlatform: { web: Totals; android: Totals };
  byAudience: { student: Totals; parent: Totals; guest: Totals };
  series: ActivePoint[];
  hoursOfDay: { label: string; visitors: number }[];
  signups: SignupPoint[];
}

export interface TicketDetail extends TicketRow {
  thread: { id: number; body: string; isStaff: boolean; sender: string; staffName: string; at: string }[];
}

export interface PodcastRow {
  id: number;
  title: string;
  category: string;
  icon: string;
  durationMinutes: number;
  audioSrc: string;
  audioUrl: string;
  fileName: string;
  hasAudio: boolean;
  isActive: boolean;
  sort: number;
  listens: number | null;
  createdFa: string;
}

export interface BlogRow {
  id: number;
  title: string;
  slug: string;
  summary: string;
  coverUrl: string;
  category: string;
  tags: string[];
  status: 'draft' | 'published';
  publishedFa: string;
  readingMinutes: number;
  author: string;
  updatedFa?: string;
  isLive?: boolean;
}

export interface BlogDetail extends BlogRow {
  body: string;
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
}

export interface NoticeRow {
  id: number;
  audience: 'parents' | 'students';
  audienceLabel: string;
  title: string;
  body: string;
  link: string;
  filtersLabel: string;
  recipients: number;
  read: number;
  sentBy: string;
  at: string;
}

export interface StaffRow {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  isSuperuser: boolean;
  isActive: boolean;
  title: string;
  capabilities: Capability[];
  lastLoginFa: string;
  lastSeen: LastSeen;
  createdFa: string;
}

export interface AuditRow {
  id: number;
  action: string;
  actionLabel: string;
  actor: string;
  actorId: number | null;
  target: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ip: string;
  at: string;
}

/** تگِ آموزشی (داشبورد ← تگ‌های آموزشی) با آمارِ ۳۰ روزِ اخیر */
export interface ConceptRow {
  id: number;
  code: string;
  title: string;
  subject: string;
  subjectLabel: string;
  grade: number | null;
  description: string;
  isActive: boolean;
  answers: number;
  errors: number;
  games: number;
}

/** کدی که بازی‌ها فرستاده‌اند ولی ثبت نشده */
export interface UnknownConcept {
  code: string;
  count: number;
  games: number;
  exampleGame: string;
  lastSeenFa: string;
}
