import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  HiOutlineBold, HiOutlineChatBubbleBottomCenterText, HiOutlineChevronRight, HiOutlineH1, HiOutlineLink,
  HiOutlineListBullet, HiOutlinePhoto,
} from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { Check, Field, FormGrid, SelectField, TextArea, TextField } from '../../components/Fields/Fields';
import { ConfirmDialog } from '../../components/Modal/Modal';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { ErrorState, Loading } from '../../components/States/States';
import { useToast } from '../../components/Toast/toastContext';
import { useLearnEdit } from '../../features/data/hooks';
import { api, messageOf, send } from '../../lib/api';
import { faNum, latinDigits } from '../../lib/format';
import type { LearnEditDetail } from '../../types';
import { useInserter } from '../blog/useEditor';
import own from '../blog/Blog.module.css';
import local from './Learn.module.css';
import back from '../users/UserDetail.module.css';
import { KINDS, TOPICS } from './options';

/** پیش‌نمایشِ متن با همان مبدلِ سرور (پنلِ والدین همین را نشان می‌دهد) */
function usePreview(body: string) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      send<{ html: string }>('post', 'learn/preview', { body }).then((r) => setHtml(r.html)).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [body]);
  return html;
}

/** مدت را از خودِ فایل می‌خواند (روی همین مرورگر؛ چیزی جایی نمی‌رود) */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
    media.preload = 'metadata';
    media.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(media.duration) ? media.duration : 0); };
    media.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    media.src = url;
  });
}

export function LearnEditorPage() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const { data, error, isLoading, refetch } = useLearnEdit(id, !isNew);
  const navigate = useNavigate();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);
  if (!isNew && isLoading) return <Loading />;
  if (!isNew && !data) return <ErrorState message={messageOf(error, 'محتوا پیدا نشد.')} onRetry={() => void refetch()} />;

  const remove = async () => {
    try {
      await send('delete', `learn/${id}`);
      toast('محتوا حذف شد.');
      navigate('/learn');
    } catch (e) {
      toast(messageOf(e), 'error');
    }
  };

  return (
    <>
      <PageHeader title={isNew ? 'محتوای تازه' : (data as LearnEditDetail).title}
        description={isNew ? 'مقاله، ویدیو یا پادکست برای صفحه‌ی «آموزش» پنلِ والدین.'
          : `${(data as LearnEditDetail).kindLabel}، ${faNum((data as LearnEditDetail).views)} بازدید`}
        back={<Link to="/learn" className={back.back}><HiOutlineChevronRight aria-hidden />آموزشِ والدین</Link>}
        actions={!isNew && <>
          {data?.status === 'published' ? <Badge tone={data.isLive ? 'green' : 'amber'} dot>منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
          <Button variant="danger" size="sm" onClick={() => setRemoving(true)}>حذف</Button>
        </>} />
      <LearnForm key={data?.id ?? 'new'} item={data ?? null}
        onSaved={(saved) => (isNew ? navigate(`/learn/${saved.id}`, { replace: true }) : void refetch())} />
      <ConfirmDialog open={removing} title="حذفِ محتوا" danger confirmLabel="حذف شود" onClose={() => setRemoving(false)}
        message="از پنلِ والدین هم برداشته می‌شود و فایلش پاک می‌شود." onConfirm={() => void remove()} />
    </>
  );
}

function LearnForm({ item, onSaved }: { item: LearnEditDetail | null; onSaved: (item: LearnEditDetail) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    kind: item?.kind ?? 'article', title: item?.title ?? '', summary: item?.summary ?? '', topic: item?.topic ?? 'learning',
    body: item?.body ?? '', mediaUrl: item?.mediaUrl ?? '', durationMinutes: String(item?.durationMinutes ?? 0),
    author: item?.author ?? 'تیم آموزشی لوکو', premium: item?.premium ?? false, featured: item?.featured ?? false,
    sort: String(item?.sort ?? 0),
  });
  const [cover, setCover] = useState<File | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const html = usePreview(form.body);
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : ''), [cover]);
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  const editor = useInserter(form.body, (body) => setForm((f) => ({ ...f, body })));
  const isMedia = form.kind !== 'article';

  const pickMedia = async (file: File | null) => {
    setMediaFile(file);
    if (!file) return;
    const seconds = await readDuration(file);
    if (seconds > 0) setForm((f) => ({ ...f, durationMinutes: String(Math.max(1, Math.round(seconds / 60))) }));
  };

  const save = async (status: 'draft' | 'published') => {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, typeof v === 'boolean' ? String(v) : latinDigits(String(v))));
    body.append('status', status);
    if (cover) body.append('cover', cover);
    if (mediaFile) body.append('mediaFile', mediaFile);
    setBusy(status);
    setProgress(mediaFile ? 0 : null);
    try {
      const { data } = await api.request({
        method: item ? 'patch' : 'post', url: item ? `learn/${item.id}` : 'learn', data: body,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => mediaFile && e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      await queryClient.invalidateQueries({ queryKey: ['learn'] });
      toast(status === 'published' ? 'منتشر شد؛ در پنلِ والدین دیده می‌شود.' : 'پیش‌نویس ذخیره شد.');
      setCover(null);
      setMediaFile(null);
      onSaved(data.data as LearnEditDetail);
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    setBusy('image');
    try {
      const res = await send<{ url: string }>('post', 'learn/images', body);
      editor.wrap('\n![', `](${res.url})\n`, 'توضیحِ عکس');
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const publishLabel = progress !== null && progress < 100 ? `در حالِ بارگذاری ${faNum(progress)}٪`
    : item?.status === 'published' ? 'ذخیره (منتشرشده)' : 'انتشار';

  return (
    <div className={own.layout}>
      <div className={own.main}>
        <Card>
          <FormGrid>
            <SelectField label="نوع" value={form.kind} options={KINDS}
              onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })} />
            <SelectField label="موضوع" value={form.topic} options={TOPICS} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          </FormGrid>
          <div className={own.gap}>
            <TextField label="عنوان" value={form.title} maxLength={140} required onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className={own.gap}>
            <TextArea label="خلاصه" value={form.summary} maxLength={300} rows={2}
              hint="یکی دو جمله؛ روی کارت و در پیش‌نمایشِ محتوای ویژه دیده می‌شود."
              onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className={own.toolbar} role="toolbar" aria-label="قالب‌بندی">
            <button type="button" onClick={() => editor.line('## ', 'تیتر')} title="تیتر"><HiOutlineH1 aria-hidden /></button>
            <button type="button" onClick={() => editor.wrap('**', '**', 'متنِ پررنگ')} title="پررنگ"><HiOutlineBold aria-hidden /></button>
            <button type="button" onClick={() => editor.line('- ', 'مورد')} title="فهرست"><HiOutlineListBullet aria-hidden /></button>
            <button type="button" onClick={() => editor.line('> ', 'نکته')} title="نکته"><HiOutlineChatBubbleBottomCenterText aria-hidden /></button>
            <button type="button" onClick={() => editor.wrap('[', '](https://)', 'متنِ پیوند')} title="پیوند"><HiOutlineLink aria-hidden /></button>
            <label title="عکس داخلِ متن" aria-busy={busy === 'image' || undefined}>
              <HiOutlinePhoto aria-hidden />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="visually-hidden"
                onChange={(e) => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          <textarea ref={editor.ref} className={own.body} value={form.body} aria-label="متن"
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={isMedia ? 'یادداشتِ زیرِ ویدیو یا پادکست (اختیاری)…'
              : '## تیتر\nیک پاراگراف…\n\n- یک مورد\n**مهم**'} />
          <small className={local.hint}>
            محتوای ویژه برای والدِ بی‌اشتراک فقط تا دو بندِ اول دیده می‌شود؛ بندِ اول را جذاب بنویسید.
          </small>
        </Card>
        <Card title="پیش‌نمایش" description="همان چیزی که والد در پنل می‌بیند">
          <article className={own.preview} dangerouslySetInnerHTML={{ __html: html }} />
        </Card>
      </div>
      <aside className={own.side}>
        <Card title="انتشار">
          <div className={own.publish}>
            <Button variant="primary" loading={busy === 'published'} disabled={!form.title.trim()} onClick={() => void save('published')}>
              {publishLabel}
            </Button>
            <Button loading={busy === 'draft'} disabled={!form.title.trim()} onClick={() => void save('draft')}>
              {item?.status === 'published' ? 'برگرداندن به پیش‌نویس' : 'ذخیره‌ی پیش‌نویس'}
            </Button>
          </div>
        </Card>
        <Card title="دسترسی و جایگاه">
          <div className={own.stack}>
            <Check label="ویژه‌ی مشترکان" description="بی‌اشتراک: کارت و دو بندِ اول؛ بقیه و پخش‌کننده قفل"
              checked={form.premium} onChange={(premium) => setForm({ ...form, premium })} />
            <Check label="برگزیده" description="بالای صفحه‌ی آموزش (اولین برگزیده)"
              checked={form.featured} onChange={(featured) => setForm({ ...form, featured })} />
            <FormGrid>
              <TextField label="نویسنده یا گوینده" value={form.author} maxLength={60}
                onChange={(e) => setForm({ ...form, author: e.target.value })} />
              <TextField label="ترتیب" value={form.sort} inputMode="numeric" hint="کوچک‌تر بالاتر"
                onChange={(e) => setForm({ ...form, sort: e.target.value })} />
            </FormGrid>
          </div>
        </Card>
        {isMedia && (
          <Card title={form.kind === 'video' ? 'ویدیو' : 'فایلِ صوتی'}>
            <div className={own.stack}>
              {item?.mediaFileName && !mediaFile && <small className={local.hint}>فایلِ فعلی: {item.mediaFileName}</small>}
              <Field label="بارگذاریِ فایل" hint={form.kind === 'video' ? 'MP4 یا WebM تا ۹۵ مگابایت' : 'MP3 یا M4A تا ۹۵ مگابایت'}>
                <input type="file" accept={form.kind === 'video' ? 'video/mp4,video/webm' : 'audio/*'}
                  onChange={(e) => void pickMedia(e.target.files?.[0] ?? null)} />
              </Field>
              <TextField label="یا نشانی" value={form.mediaUrl} dir="ltr"
                hint={form.kind === 'video' ? 'پیوندِ آپارات (aparat.com/v/…) یا فایلِ مستقیمِ https' : 'فایلِ مستقیمِ https (…/episode.mp3)'}
                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} />
              <TextField label="مدت (دقیقه)" value={form.durationMinutes} inputMode="numeric" hint="با انتخابِ فایل خودش پر می‌شود"
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
          </Card>
        )}
        <Card title="تصویرِ شاخص">
          {(coverPreview || item?.coverUrl) && <img className={own.cover} alt="" src={coverPreview || item?.coverUrl} />}
          <Field label="انتخابِ عکس" hint="اختیاری؛ بی‌عکس، طرحِ رنگیِ موضوع نشان داده می‌شود. JPG، PNG یا WebP تا ۵ مگابایت">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
          </Field>
        </Card>
      </aside>
    </div>
  );
}
