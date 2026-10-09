import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HiOutlineChevronRight, HiOutlinePaperAirplane } from 'react-icons/hi2';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Card } from '../../components/Card/Card';
import { TextArea } from '../../components/Fields/Fields';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { ErrorState, Loading } from '../../components/States/States';
import { useToast } from '../../components/Toast/toastContext';
import { useAction, useTicket } from '../../features/data/hooks';
import { messageOf } from '../../lib/api';
import { faNum } from '../../lib/format';
import { TICKET_TONE } from './tone';
import own from './Ticket.module.css';
import back from '../users/UserDetail.module.css';

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data: ticket, error, isLoading, refetch } = useTicket(id);
  const [body, setBody] = useState('');
  const keys = ['ticket', 'tickets', 'overview'];
  const reply = useAction<{ body: string }>('post', `tickets/${id}/reply`, keys);
  const status = useAction<{ status: string }>('post', `tickets/${id}/status`, keys);
  if (isLoading) return <Loading />;
  if (!ticket) return <ErrorState message={messageOf(error, 'تیکت پیدا نشد.')} onRetry={() => void refetch()} />;

  const send = async () => {
    try {
      await reply.mutateAsync({ body });
      setBody('');
      toast('پاسخ فرستاده شد؛ والد اعلان گرفت.');
    } catch (e) {
      toast(messageOf(e), 'error');
    }
  };
  const change = (next: string) => status.mutateAsync({ status: next }).then(() => toast('وضعیت عوض شد.'))
    .catch((e: unknown) => toast(messageOf(e), 'error'));

  return (
    <>
      <PageHeader title={ticket.subject} description={`#${faNum(ticket.id)} · ${ticket.createdFa}`}
        back={<Link to="/tickets" className={back.back}><HiOutlineChevronRight aria-hidden />پشتیبانی</Link>}
        actions={<>
          <Badge tone={TICKET_TONE[ticket.status]} dot>{ticket.statusLabel}</Badge>
          {ticket.status !== 'closed'
            ? <Button size="sm" loading={status.isPending} onClick={() => void change('closed')}>بستنِ تیکت</Button>
            : <Button size="sm" loading={status.isPending} onClick={() => void change('open')}>بازکردنِ دوباره</Button>}
        </>} />
      <Card title={<Link to={`/users/${ticket.userId}`}>{ticket.userName}</Link>} description={ticket.userPhone}>
        <ol className={own.thread}>
          {ticket.thread.map((m) => (
            <li key={m.id} data-staff={m.isStaff || undefined}>
              <div className={own.meta}><b>{m.isStaff ? `${m.sender} (${m.staffName || 'تیم'})` : m.sender}</b><small>{m.at}</small></div>
              <p className={own.body}>{m.body}</p>
            </li>
          ))}
        </ol>
        <div className={own.reply}>
          <TextArea label="پاسخِ شما" value={body} maxLength={4000} rows={4} onChange={(e) => setBody(e.target.value)}
            placeholder="با مهربانی و دقیق؛ والد این را در پنلش می‌خواند." />
          <Button variant="primary" icon={<HiOutlinePaperAirplane aria-hidden />} loading={reply.isPending}
            disabled={!body.trim()} onClick={() => void send()}>فرستادنِ پاسخ</Button>
        </div>
      </Card>
    </>
  );
}
