import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/Button/Button';
import { Check, Field, FormGrid, SelectField, TextField } from '../../components/Fields/Fields';
import { Modal } from '../../components/Modal/Modal';
import { useToast } from '../../components/Toast/toastContext';
import { useMeta } from '../../features/data/hooks';
import { api, messageOf } from '../../lib/api';
import { faNum, latinDigits } from '../../lib/format';
import type { PodcastRow } from '../../types';
import own from './Podcasts.module.css';

interface Props {
  podcast: PodcastRow | null;
  open: boolean;
  onClose: () => void;
}

/** مدت را از خودِ فایل می‌خواند (محلی؛ چیزی جایی نمی‌رود) */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(audio.duration) ? audio.duration : 0); };
    audio.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    audio.src = url;
  });
}

export function PodcastForm({ podcast, open, onClose }: Props) {
  const meta = useMeta().data;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: podcast?.title ?? '', category: podcast?.category ?? 'قصه', icon: podcast?.icon ?? '',
    durationMinutes: String(podcast?.durationMinutes ?? 0), audioUrl: podcast?.audioUrl ?? '',
    sort: String(podcast?.sort ?? 0), isActive: podcast?.isActive ?? true,
  });
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async (next: File | null) => {
    setFile(next);
    setNote('');
    if (!next) return;
    const seconds = await readDuration(next);
    if (seconds > 0) {
      setForm((f) => ({ ...f, durationMinutes: String(Math.max(1, Math.round(seconds / 60))) }));
      setNote(`مدتِ فایل: ${faNum(Math.floor(seconds / 60))} دقیقه و ${faNum(Math.round(seconds % 60))} ثانیه`);
    } else {
      setNote('مرورگر این فایل را نمی‌شناسد؛ MP3 بهتر است.');
    }
  };

  const save = async () => {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, typeof v === 'boolean' ? String(v) : latinDigits(String(v))));
    if (file) body.append('audioFile', file);
    setProgress(0);
    try {
      await api.request({
        method: podcast ? 'patch' : 'post', url: podcast ? `podcasts/${podcast.id}` : 'podcasts', data: body,
        headers: { 'Content-Type': 'multipart/form-data' },
        // فایلِ بزرگ روی اینترنتِ معمولی بیش از سقفِ ۶۰ ثانیه‌ایِ کلاینت طول می‌کشد و وسطِ راه بریده می‌شد
        timeout: 0,
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      await queryClient.invalidateQueries({ queryKey: ['podcasts'] });
      toast(podcast ? 'پادکست ذخیره شد.' : 'پادکست اضافه شد.');
      onClose();
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setProgress(null);
    }
  };

  const icons = [{ value: '', label: 'آیکونِ دسته (پیش‌فرض)' }, ...(meta?.podcastIcons ?? [])];
  return (
    <Modal open={open} wide title={podcast ? 'ویرایشِ پادکست' : 'پادکستِ تازه'} onClose={onClose} footer={<>
      <Button onClick={onClose}>انصراف</Button>
      <Button variant="primary" loading={progress !== null} onClick={() => void save()} disabled={!form.title.trim()}>
        {progress !== null && progress < 100 ? `در حالِ بارگذاری ${faNum(progress)}٪` : 'ذخیره'}
      </Button>
    </>}>
      <FormGrid>
        <TextField label="عنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <TextField label="دسته" value={form.category} list="podcast-cats" onChange={(e) => setForm({ ...form, category: e.target.value })}
          hint="یکی از پیشنهادها یا دسته‌ی تازه، مثلاً «مشاهیر ایرانی»" />
        <SelectField label="آیکون" value={form.icon} options={icons} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
      </FormGrid>
      <datalist id="podcast-cats">{(meta?.podcastCategories ?? []).map((c) => <option key={c} value={c} />)}</datalist>
      <div className={own.audio}>
        <Field label="فایلِ صوتی" hint={note || 'MP3 بهترین است؛ تا ۸۰ مگابایت. مدت خودش پر می‌شود.'}>
          <input type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav" onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
        </Field>
        {podcast?.audioSrc && !file && <audio controls preload="none" src={podcast.audioSrc} className={own.player} />}
        {progress !== null && <progress className={own.progress} max={100} value={progress} />}
      </div>
      <FormGrid>
        <TextField label="یا نشانیِ مستقیمِ فایل (https)" dir="ltr" value={form.audioUrl} placeholder="https://…/episode.mp3"
          onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
          hint="نه صفحه‌ی «پخشِ آنلاین»؛ نشانیِ خودِ فایل. بهتر است فایل را همین بالا بارگذاری کنید." />
        <TextField label="مدت (دقیقه)" inputMode="numeric" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
        <TextField label="ترتیبِ نمایش" inputMode="numeric" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })}
          hint="عددِ کوچک‌تر بالاتر" />
      </FormGrid>
      <div style={{ marginTop: 14 }}>
        <Check label="در سایت نشان داده شود" checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} />
      </div>
    </Modal>
  );
}
