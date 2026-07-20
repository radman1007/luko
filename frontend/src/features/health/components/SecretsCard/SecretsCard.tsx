import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  HiOutlineLockClosed,
  HiOutlineLockOpen,
  HiOutlinePlus,
  HiOutlineShieldCheck,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { useSecrets } from '../../useSecrets';
import styles from './SecretsCard.module.css';

export function SecretsCard() {
  const guard = LUKORIANS.guard;
  const { secrets, add, unlock, remove } = useSecrets();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [openId, setOpenId] = useState<string | null>(null);
  const [unlockPass, setUnlockPass] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState('');

  const resetUnlock = (id: string | null) => {
    setOpenId(id);
    setUnlockPass('');
    setRevealed(null);
    setError('');
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    await add(title.trim(), text, password);
    setTitle('');
    setText('');
    setPassword('');
    setShowForm(false);
    setBusy(false);
  };

  const handleUnlock = async (id: string) => {
    setBusy(true);
    const plain = await unlock(id, unlockPass);
    setBusy(false);
    if (plain === null) {
      setError('رمز درست نیست!');
      return;
    }
    setError('');
    setRevealed(plain);
  };

  const handleRemove = async (id: string) => {
    setBusy(true);
    const ok = await remove(id, unlockPass);
    setBusy(false);
    if (!ok) {
      setError('برای پاک کردن هم رمز درست لازمه!');
      return;
    }
    resetUnlock(null);
  };

  return (
    <section className={styles.card} aria-label="صندوقچه‌ی رازها">
      <div className={styles.head}>
        <img className={styles.character} src={guard.image} alt={guard.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{guard.name}، {guard.role}</p>
          <p className={styles.text}>
            من از رازهات نگهبانی می‌دم! هر راز با رمز خودت قفل می‌شه؛ بدون رمز، حتی من هم بازش
            نمی‌کنم.
          </p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      {/* گاوصندوق فولادی */}
      <div className={styles.vault}>
        <div className={styles.vaultHead}>
          <span className={styles.vaultTitle}>
            <HiOutlineShieldCheck aria-hidden />
            صندوقچه‌ی رازها
          </span>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowForm((v) => !v)}
            aria-label="راز جدید"
          >
            <HiOutlinePlus />
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={handleCreate}>
            <input
              className={styles.input}
              placeholder="اسم راز (مثلاً: راز روز جمعه)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              required
            />
            <textarea
              className={styles.textarea}
              placeholder="رازت رو اینجا بنویس…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={500}
              required
            />
            <input
              className={styles.input}
              type="password"
              placeholder="یه رمز مخصوص این راز"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={4}
              autoComplete="new-password"
              required
            />
            <button type="submit" className={styles.submit} disabled={busy}>
              <HiOutlineLockClosed aria-hidden />
              قفلش کن
            </button>
          </form>
        )}

        {secrets.length === 0 && !showForm && (
          <p className={styles.empty}>هنوز رازی به آهنین نسپردی</p>
        )}

        <ul className={styles.list}>
          {secrets.map((secret) => {
            const isOpen = openId === secret.id;
            const isRevealed = isOpen && revealed !== null;
            return (
              <li key={secret.id} className={`${styles.item} ${isRevealed ? styles.open : ''}`}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => resetUnlock(isOpen ? null : secret.id)}
                >
                  <span className={styles.lockIcon} aria-hidden>
                    {isRevealed ? <HiOutlineLockOpen /> : <HiOutlineLockClosed />}
                  </span>
                  <span className={styles.itemTitle}>{secret.title}</span>
                </button>

                {isOpen && (
                  <div className={styles.unlockBox}>
                    {revealed === null ? (
                      <>
                        <input
                          className={styles.input}
                          type="password"
                          placeholder="رمز این راز"
                          value={unlockPass}
                          onChange={(e) => setUnlockPass(e.target.value)}
                          autoComplete="off"
                        />
                        {error && <p className={styles.error}>{error}</p>}
                        <div className={styles.unlockActions}>
                          <button
                            type="button"
                            className={styles.submit}
                            onClick={() => handleUnlock(secret.id)}
                            disabled={busy || unlockPass.length === 0}
                          >
                            بازش کن
                          </button>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleRemove(secret.id)}
                            disabled={busy || unlockPass.length === 0}
                            aria-label="حذف راز"
                          >
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className={styles.revealed}>{revealed}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
