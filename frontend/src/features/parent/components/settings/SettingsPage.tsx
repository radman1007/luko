import type { ReactNode } from 'react';
import { SubPage } from '../views/SubPage';
import { AboutPage } from './AboutPage';
import { BillingPage } from './BillingPage';
import { ChildProfilePage } from './ChildProfilePage';
import { NewTicketPage } from './NewTicketPage';
import { NotificationsPage } from './NotificationsPage';
import { PrivacyPage } from './PrivacyPage';
import { childName, useSettingsEnv } from './SettingsContext';
import type { SettingsSection } from './SettingsContext';
import { SettingsHub } from './SettingsHub';
import { SupportPage } from './SupportPage';
import { TicketPage } from './TicketPage';

interface Props {
  section: string;
  id: string;
}

const SECTIONS = new Set<SettingsSection>(['child', 'billing', 'notifications', 'support', 'newticket', 'ticket', 'privacy', 'about']);

/** تنظیمات: صفحه‌ی اصلی، یا یکی از بخش‌ها با سرصفحه و دکمه‌ی برگشت */
export function SettingsPage({ section, id }: Props) {
  const env = useSettingsEnv();
  const key = (SECTIONS.has(section as SettingsSection) ? section : '') as SettingsSection;
  if (!key) return <SettingsHub />;

  const toHub = () => env.open('');
  const toSupport = () => env.open('support');
  let title = '';
  let note = '';
  let back = toHub;
  let backLabel = 'تنظیمات';
  let body: ReactNode = null;

  switch (key) {
    case 'child': {
      const child = env.childList.find((item) => item.id === id);
      title = child ? childName(child) : 'مشخصاتِ فرزند';
      note = 'مشخصات، آمار، ورود و اشتراک';
      body = <ChildProfilePage childId={id} />;
      break;
    }
    case 'billing':
      title = 'اشتراک و پرداخت‌ها';
      note = 'اشتراکِ هر فرزند جداست؛ پلن، تمدید و صورت‌حساب‌ها';
      body = <BillingPage />;
      break;
    case 'notifications':
      title = 'اعلان‌ها';
      note = 'همه‌ی خبرها درباره‌ی فرزندان، اشتراک و پشتیبانی';
      body = <NotificationsPage />;
      break;
    case 'support':
      title = 'پشتیبانی و تیکت‌ها';
      note = 'پرسش‌های پرتکرار و تیکت';
      body = <SupportPage />;
      break;
    case 'newticket':
      title = 'تیکتِ تازه';
      note = 'تیمِ لوکو پاسخ را همین‌جا و در اعلان‌ها می‌فرستد';
      back = toSupport;
      backLabel = 'پشتیبانی';
      body = <NewTicketPage />;
      break;
    case 'ticket':
      title = 'گفت‌وگو با پشتیبانی';
      note = 'پیام‌ها، پاسخ و وضعیتِ تیکت';
      back = toSupport;
      backLabel = 'پشتیبانی';
      body = <TicketPage ticketId={Number(id) || 0} />;
      break;
    case 'privacy':
      title = 'حریم خصوصی و امنیت';
      note = 'رمز و شماره‌ی شما و فرزندان، و تعهدِ لوکو';
      body = <PrivacyPage />;
      break;
    case 'about':
      title = 'درباره‌ی لوکو';
      note = 'قوانین، حریم خصوصی و نمادِ اعتماد';
      body = <AboutPage />;
      break;
    default:
      break;
  }

  return (
    <SubPage title={title} note={note} onBack={back} backLabel={backLabel} wide>
      {body}
    </SubPage>
  );
}
