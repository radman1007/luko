import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  HiOutlineBold, HiOutlineChatBubbleBottomCenterText, HiOutlineH1, HiOutlineLink, HiOutlineListBullet, HiOutlinePhoto,
} from 'react-icons/hi2';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { Field, FormGrid, TextArea, TextField } from '../../components/Fields/Fields';
import { useToast } from '../../components/Toast/toastContext';
import { api, messageOf, send } from '../../lib/api';
import type { BlogDetail } from '../../types';
import { useInserter, usePreview } from './useEditor';
import own from './Blog.module.css';

interface Props {
  post: BlogDetail | null;
  onSaved: (post: BlogDetail) => void;
}

export function PostForm({ post, onSaved }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: post?.title ?? '', summary: post?.summary ?? '', category: post?.category ?? '',
    tags: post?.tags.join('، ') ?? '', body: post?.body ?? '', seoTitle: post?.seoTitle ?? '', seoDescription: post?.seoDescription ?? '',
  });
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const html = usePreview(form.body);
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : ''), [cover]);
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  const editor = useInserter(form.body, (body) => setForm((f) => ({ ...f, body })));

  const save = async (status: 'draft' | 'published') => {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('status', status);
    if (cover) body.append('cover', cover);
    setBusy(status);
    try {
      const { data } = await api.request({ method: post ? 'patch' : 'post', url: post ? `blog/${post.id}` : 'blog', data: body,
        headers: { 'Content-Type': 'multipart/form-data' } });
      await queryClient.invalidateQueries({ queryKey: ['blog'] });
      toast(status === 'published' ? 'منتشر شد؛ روی سایتِ لندینگ دیده می‌شود.' : 'پیش‌نویس ذخیره شد.');
      setCover(null);
      onSaved(data.data as BlogDetail);
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const uploadImage = async (file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    setBusy('image');
    try {
      const res = await send<{ url: string }>('post', 'blog/images', body);
      editor.wrap(`\n![`, `](${res.url})\n`, 'توضیحِ عکس');
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={own.layout}>
      <div className={own.main}>
        <Card>
          <FormGrid>
            <TextField label="عنوان" value={form.title} maxLength={160} required onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <TextField label="دسته" value={form.category} maxLength={60} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </FormGrid>
          <div className={own.gap}>
            <TextArea label="خلاصه" value={form.summary} maxLength={300} rows={2} hint="در فهرستِ پست‌ها و پیش‌نمایشِ لینک دیده می‌شود."
              onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div className={own.toolbar} role="toolbar" aria-label="قالب‌بندی">
            <button type="button" onClick={() => editor.line('## ', 'تیتر')} title="تیتر"><HiOutlineH1 aria-hidden /></button>
            <button type="button" onClick={() => editor.wrap('**', '**', 'متنِ پررنگ')} title="پررنگ"><HiOutlineBold aria-hidden /></button>
            <button type="button" onClick={() => editor.line('- ', 'مورد')} title="فهرست"><HiOutlineListBullet aria-hidden /></button>
            <button type="button" onClick={() => editor.line('> ', 'نقل‌قول')} title="نقل‌قول"><HiOutlineChatBubbleBottomCenterText aria-hidden /></button>
            <button type="button" onClick={() => editor.wrap('[', '](https://)', 'متنِ پیوند')} title="پیوند"><HiOutlineLink aria-hidden /></button>
            <label title="عکس داخلِ متن" aria-busy={busy === 'image' || undefined}>
              <HiOutlinePhoto aria-hidden />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="visually-hidden"
                onChange={(e) => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          <textarea ref={editor.ref} className={own.body} value={form.body} aria-label="متنِ پست"
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={'## تیتر\nیک پاراگراف…\n\n- یک مورد\n**مهم** و [پیوند](https://luko.ir)'} />
        </Card>
        <Card title="پیش‌نمایش" description="همان چیزی که روی سایت دیده می‌شود">
          <article className={own.preview} dangerouslySetInnerHTML={{ __html: html }} />
        </Card>
      </div>
      <aside className={own.side}>
        <Card title="انتشار">
          <div className={own.publish}>
            <Button variant="primary" loading={busy === 'published'} disabled={!form.title.trim()} onClick={() => void save('published')}>
              {post?.status === 'published' ? 'ذخیره (منتشرشده)' : 'انتشار'}
            </Button>
            <Button loading={busy === 'draft'} disabled={!form.title.trim()} onClick={() => void save('draft')}>
              {post?.status === 'published' ? 'برگرداندن به پیش‌نویس' : 'ذخیره‌ی پیش‌نویس'}
            </Button>
          </div>
        </Card>
        <Card title="تصویرِ شاخص">
          {(coverPreview || post?.coverUrl) && <img className={own.cover} alt="" src={coverPreview || post?.coverUrl} />}
          <Field label="انتخابِ عکس" hint="JPG، PNG یا WebP تا ۵ مگابایت">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
          </Field>
        </Card>
        <Card title="برچسب و سئو">
          <div className={own.stack}>
            <TextField label="برچسب‌ها" value={form.tags} hint="با ویرگول جدا: تربیت، بازی" onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <TextField label="عنوانِ سئو" value={form.seoTitle} maxLength={160} hint="خالی = همان عنوان"
              onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
            <TextArea label="توضیحِ سئو" value={form.seoDescription} maxLength={300} rows={3} hint="خالی = همان خلاصه"
              onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
        </Card>
      </aside>
    </div>
  );
}
