import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBell, HiOutlineChevronLeft, HiOutlineXMark } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { useKidNotices } from '../../useKidNotices';
import styles from './NoticeBell.module.css';

/** زنگوله‌ی پیام‌های لوکو روی سرصفحه‌ی خانه + برگه‌ی پیام‌ها */
export function NoticeBell() {
  const { enabled, data, markRead } = useKidNotices();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);
  const host = LUKORIANS.luko;

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    // نخوانده‌ها لحظه‌ای پررنگ بمانند، بعد خوانده شوند
    const timer = window.setTimeout(() => data.unread > 0 && markRead(), 1500);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open, data.unread, markRead]);

  if (!enabled) return null;
  const unread = data.unread;

  return (
    <>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen(true)}
        aria-label={unread ? `پیام‌ها، ${unread.toLocaleString('fa-IR')} پیامِ تازه` : 'پیام‌ها'}
      >
        <HiOutlineBell aria-hidden />
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}</span>}
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby="kid-notices-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.head}>
              <img className={styles.host} src={host.image} alt="" aria-hidden />
              <div>
                <h2 id="kid-notices-title" className={styles.title}>پیام‌های لوکو</h2>
                <p className={styles.sub}>{host.name} هر خبرِ تازه را این‌جا می‌گذارد</p>
              </div>
              <button ref={closeRef} type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="بستن">
                <HiOutlineXMark aria-hidden />
              </button>
            </header>

            {data.items.length === 0 ? (
              <p className={styles.empty}>هنوز پیامی نیامده؛ خبرهای تازه همین‌جا می‌رسند!</p>
            ) : (
              <ul className={styles.list}>
                {data.items.map((n) => (
                  <li key={n.id} className={styles.item} data-unread={n.isRead ? undefined : 'true'}>
                    <div className={styles.texts}>
                      <b className={styles.itemTitle}>{n.title}</b>
                      {n.body && <p className={styles.itemBody}>{n.body}</p>}
                      <small className={styles.at}>{n.at}</small>
                    </div>
                    {n.link && (
                      <button
                        type="button"
                        className={styles.go}
                        onClick={() => {
                          setOpen(false);
                          navigate(n.link);
                        }}
                      >
                        برو
                        <HiOutlineChevronLeft aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
