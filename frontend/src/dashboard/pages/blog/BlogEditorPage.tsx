import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { HiOutlineChevronRight } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/Modal/Modal';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { ErrorState, Loading } from '../../components/States/States';
import { useToast } from '../../components/Toast/toastContext';
import { usePost } from '../../features/data/hooks';
import { messageOf, send } from '../../lib/api';
import type { BlogDetail } from '../../types';
import { PostForm } from './PostForm';
import back from '../users/UserDetail.module.css';

export function BlogEditorPage() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const { data, error, isLoading, refetch } = usePost(id, !isNew);
  const navigate = useNavigate();
  const toast = useToast();
  const [removing, setRemoving] = useState(false);
  if (!isNew && isLoading) return <Loading />;
  if (!isNew && !data) return <ErrorState message={messageOf(error, 'پست پیدا نشد.')} onRetry={() => void refetch()} />;

  const remove = async () => {
    try {
      await send('delete', `blog/${id}`);
      toast('پست حذف شد.');
      navigate('/blog');
    } catch (e) {
      toast(messageOf(e), 'error');
    }
  };

  return (
    <>
      <PageHeader title={isNew ? 'پستِ تازه' : (data as BlogDetail).title}
        description={isNew ? 'متن را با چند نشانه‌ی ساده بنویسید؛ پیش‌نمایش کنارِ آن است.'
          : `نامک: ${(data as BlogDetail).slug}`}
        back={<Link to="/blog" className={back.back}><HiOutlineChevronRight aria-hidden />وبلاگ</Link>}
        actions={!isNew && <>
          {data?.status === 'published' ? <Badge tone={data.isLive ? 'green' : 'amber'} dot>منتشرشده</Badge> : <Badge>پیش‌نویس</Badge>}
          <Button variant="danger" size="sm" onClick={() => setRemoving(true)}>حذف</Button>
        </>} />
      <PostForm key={data?.id ?? 'new'} post={data ?? null}
        onSaved={(saved) => isNew ? navigate(`/blog/${saved.id}`, { replace: true }) : void refetch()} />
      <ConfirmDialog open={removing} title="حذفِ پست" danger confirmLabel="حذف شود" onClose={() => setRemoving(false)}
        message="پست از سایت هم برداشته می‌شود و برنمی‌گردد." onConfirm={() => void remove()} />
    </>
  );
}
