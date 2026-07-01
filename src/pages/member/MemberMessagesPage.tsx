import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService, messageService } from '../../services/api';
import type { Message, User } from '../../types/models';
import { formatDisplayDate, formatDisplayDateTime } from '../../utils/date';

const formatBubbleTime = (dateValue: string) => formatDisplayDateTime(dateValue);

const getDayDividerLabel = (dateValue: string) => {
  const target = new Date(dateValue);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86400000,
  );

  if (diffDays === 0) {
    return 'Hari ini';
  }

  if (diffDays === 1) {
    return 'Kemarin';
  }

  return formatDisplayDate(dateValue);
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const MemberMessagesPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Message[]>([]);
  const [admin, setAdmin] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  usePageTitle('Pesan ke Admin');

  const refresh = () => {
    if (!user) {
      return;
    }
    messageService.listForUser(user.id).then(setItems);
  };

  useEffect(() => {
    adminService.adminProfile().then(setAdmin);
    refresh();
  }, [user]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [items.length]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !message.trim()) {
      return;
    }
    if (!admin) {
      return;
    }
    await messageService.sendMessage(user.id, admin.id, message.trim());
    setMessage('');
    refresh();
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Pesan"
        title="Hubungi admin Gym Familly"
        description="Gunakan ruang pesan ini untuk bertanya soal promo, status pembayaran, atau kendala membership."
      />
      <section className="section-intro-card">
        <div>
          <small>Bantuan member</small>
          <strong>Admin siap bantu soal pembayaran, promo, dan membership.</strong>
          <p>Tulis pesan sejelas mungkin agar balasan admin lebih cepat dan tepat.</p>
        </div>
        <div className="section-intro-meta">
          <span>Total percakapan</span>
          <strong>{items.length}</strong>
        </div>
      </section>
      <section className="panel member-inbox-panel">
        <div className="inbox-thread-header">
          <div className="inbox-thread-identity">
            <span className="inbox-thread-avatar large">{getInitials(admin?.nama ?? 'Admin')}</span>
            <div>
              <h3>Admin Gym Familly</h3>
              <p>{admin?.whatsapp ?? '-'}</p>
            </div>
          </div>
          <div className="inbox-thread-summary">
            <span className="table-chip subtle">{items.length} pesan</span>
            <small>Balasan admin akan muncul di sisi kiri seperti chat support.</small>
          </div>
        </div>

        <div className="inbox-message-stream member-inbox-stream">
          {items.length === 0 ? (
            <div className="inbox-empty-stage compact">
              <div className="inbox-empty-visual">
                <span className="inbox-empty-orb primary" />
                <span className="inbox-empty-orb secondary" />
                <span className="inbox-empty-card">
                  <strong>Support siap membantu</strong>
                  <small>Mulai percakapan pertama untuk tanya promo, pembayaran, atau membership.</small>
                </span>
              </div>
              <div className="inbox-empty-copy">
                <h3>Belum ada percakapan</h3>
                <p>Kirim pesan pertamamu agar admin bisa membantu lebih cepat.</p>
              </div>
            </div>
          ) : (
            <div className="chat-stack inbox-chat-stack">
              {items.map((item, index) => {
                const mine = item.pengirim_id === user?.id;
                const currentLabel = getDayDividerLabel(item.waktu_kirim);
                const previousLabel =
                  index > 0 ? getDayDividerLabel(items[index - 1].waktu_kirim) : null;
                const shouldRenderDivider = currentLabel !== previousLabel;

                return (
                  <div key={item.id} className="inbox-message-block">
                    {shouldRenderDivider ? (
                      <div className="chat-day-divider">
                        <span>{currentLabel}</span>
                      </div>
                    ) : null}
                    <article
                      className={`chat-bubble premium-thread-bubble ${mine ? 'mine' : 'theirs'}`}
                    >
                      <div className="premium-thread-bubble-head">
                        <strong>{mine ? 'Saya' : 'Admin'}</strong>
                        <small>{formatBubbleTime(item.waktu_kirim)}</small>
                      </div>
                      <p>{item.isi_pesan}</p>
                    </article>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>
          )}
        </div>

        <form className="message-form premium-message-form inbox-reply-form" onSubmit={handleSend}>
          <div className="panel-toolbar">
            <div>
              <h3>Kirim pesan baru</h3>
              <p>Tulis kebutuhan kamu secara singkat agar admin bisa merespons lebih cepat.</p>
            </div>
            <span className="table-chip subtle">Inbox aktif</span>
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tulis pertanyaan atau komplain kamu di sini..."
            rows={4}
          />
          <div className="inbox-reply-actions">
            <button type="submit" className="button-primary">
              Kirim Pesan
            </button>
            <small>Gunakan satu thread ini untuk semua pertanyaan soal promo, pembayaran, dan membership.</small>
          </div>
        </form>
      </section>
    </div>
  );
};
