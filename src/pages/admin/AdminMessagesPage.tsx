import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { adminService, messageService } from '../../services/api';
import type { Message, User } from '../../types/models';
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from '../../utils/date';

const formatSidebarTime = (dateValue: string) => {
  const messageDate = new Date(dateValue);
  const today = new Date();
  const sameDay = messageDate.toDateString() === today.toDateString();

  if (sameDay) {
    return formatDisplayTime(dateValue);
  }

  return formatDisplayDate(dateValue);
};

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

const getUnreadCount = (thread: Message[], adminId: number, memberId: number) => {
  const lastAdminReply = [...thread]
    .reverse()
    .find((item) => item.pengirim_id === adminId && item.penerima_id === memberId);

  if (!lastAdminReply) {
    return thread.filter((item) => item.pengirim_id === memberId).length;
  }

  return thread.filter(
    (item) =>
      item.pengirim_id === memberId && item.waktu_kirim > lastAdminReply.waktu_kirim,
  ).length;
};

export const AdminMessagesPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Message[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  usePageTitle('Inbox Admin');

  const refresh = () => {
    messageService.listAll().then(setItems);
  };

  useEffect(() => {
    adminService.members().then(setMembers);
    refresh();
  }, []);

  const conversations = members
    .map((member) => {
      const thread = items
        .filter(
          (item) =>
            (item.pengirim_id === member.id && item.penerima_id === user?.id) ||
            (item.pengirim_id === user?.id && item.penerima_id === member.id),
        )
        .sort((left, right) => left.waktu_kirim.localeCompare(right.waktu_kirim));
      const lastMessage = thread[thread.length - 1] ?? null;

      return {
        member,
        thread,
        lastMessage,
        unreadCount: user ? getUnreadCount(thread, user.id, member.id) : 0,
      };
    })
    .sort((left, right) => {
      if (!left.lastMessage && !right.lastMessage) {
        return left.member.nama.localeCompare(right.member.nama);
      }

      if (!left.lastMessage) {
        return 1;
      }

      if (!right.lastMessage) {
        return -1;
      }

      return right.lastMessage.waktu_kirim.localeCompare(left.lastMessage.waktu_kirim);
    });

  const filteredConversations = conversations.filter(({ member, lastMessage }) => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    return (
      member.nama.toLowerCase().includes(keyword) ||
      member.whatsapp.toLowerCase().includes(keyword) ||
      lastMessage?.isi_pesan.toLowerCase().includes(keyword)
    );
  });

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setActiveMemberId(null);
      return;
    }

    const activeStillExists = filteredConversations.some((entry) => entry.member.id === activeMemberId);

    if (!activeStillExists) {
      setActiveMemberId(filteredConversations[0].member.id);
    }
  }, [activeMemberId, filteredConversations]);

  const activeConversation =
    filteredConversations.find((entry) => entry.member.id === activeMemberId) ??
    filteredConversations[0] ??
    null;

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [activeConversation?.member.id, activeConversation?.thread.length]);

  const handleReply = async () => {
    if (!user || !activeConversation) {
      return;
    }

    const memberId = activeConversation.member.id;
    const text = drafts[memberId]?.trim();

    if (!text) {
      return;
    }

    await messageService.sendMessage(user.id, memberId, text);
    setDrafts((current) => ({ ...current, [memberId]: '' }));
    refresh();
  };

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Inbox"
        title="Pesan masuk dari member"
        description="Admin bisa membaca percakapan, berpindah antar member, dan membalas langsung dari dashboard."
      />
      {members.length === 0 ? (
        <section className="panel">
          <div className="inbox-empty-stage">
            <div className="inbox-empty-visual">
              <span className="inbox-empty-orb primary" />
              <span className="inbox-empty-orb secondary" />
              <span className="inbox-empty-card">
                <strong>Inbox siap dipakai</strong>
                <small>Thread member akan muncul otomatis saat ada pesan masuk.</small>
              </span>
            </div>
            <div className="inbox-empty-copy">
              <h3>Belum ada member</h3>
              <p>Daftar percakapan akan muncul di sini setelah member mulai terdaftar dan mengirim pesan.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="admin-inbox-layout">
          <aside className="panel inbox-sidebar-panel">
            <div className="panel-toolbar inbox-sidebar-header">
              <div>
                <h3>Daftar percakapan</h3>
                <p>Urutan terbaru tampil paling atas agar inbox lebih cepat dipantau.</p>
              </div>
              <span className="table-chip subtle">{filteredConversations.length} thread</span>
            </div>
            <label className="inbox-search-field">
              <span>Cari member</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, WhatsApp, atau isi pesan..."
              />
            </label>
            <div className="inbox-conversation-list">
              {filteredConversations.length === 0 ? (
                <div className="inbox-empty-inline">
                  <strong>Tidak ada hasil</strong>
                  <p>Coba kata kunci lain untuk menemukan percakapan member.</p>
                </div>
              ) : null}
              {filteredConversations.map(({ member, thread, lastMessage, unreadCount }) => {
                const isActive = member.id === activeConversation?.member.id;
                const preview =
                  lastMessage?.isi_pesan ?? 'Belum ada percakapan. Klik untuk mulai membalas member ini.';
                const senderLabel =
                  lastMessage?.pengirim_id === user?.id ? 'Admin: ' : 'Member: ';

                return (
                  <button
                    key={member.id}
                    type="button"
                    className={`inbox-thread-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveMemberId(member.id)}
                  >
                    <span className="inbox-thread-avatar">{getInitials(member.nama)}</span>
                    <span className="inbox-thread-copy">
                      <span className="inbox-thread-topline">
                        <strong>{member.nama}</strong>
                        <span className="inbox-thread-status">
                          {unreadCount > 0 ? <span className="inbox-unread-badge">{unreadCount}</span> : null}
                          <small>{lastMessage ? formatSidebarTime(lastMessage.waktu_kirim) : 'Baru'}</small>
                        </span>
                      </span>
                      <span className="inbox-thread-preview">
                        {lastMessage ? `${senderLabel}${preview}` : preview}
                      </span>
                      <span className="inbox-thread-meta">
                        <span>{member.whatsapp}</span>
                        <span className="table-chip subtle">{thread.length} pesan</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="panel inbox-thread-panel-premium">
            {activeConversation ? (
              <>
                <div className="inbox-thread-header">
                  <div className="inbox-thread-identity">
                    <span className="inbox-thread-avatar large">
                      {getInitials(activeConversation.member.nama)}
                    </span>
                    <div>
                      <h3>{activeConversation.member.nama}</h3>
                      <p>{activeConversation.member.whatsapp}</p>
                    </div>
                  </div>
                  <div className="inbox-thread-summary">
                    <span className="table-chip subtle">
                      {activeConversation.thread.length} pesan
                    </span>
                    {activeConversation.unreadCount > 0 ? (
                      <span className="table-chip danger">
                        {activeConversation.unreadCount} belum dibalas
                      </span>
                    ) : null}
                    <small>
                      {activeConversation.lastMessage
                        ? `Terakhir aktif ${formatBubbleTime(activeConversation.lastMessage.waktu_kirim)}`
                        : 'Belum ada percakapan'}
                    </small>
                  </div>
                </div>

                <div className="inbox-message-stream">
                  {activeConversation.thread.length === 0 ? (
                    <div className="inbox-empty-stage compact">
                      <div className="inbox-empty-visual">
                        <span className="inbox-empty-orb primary" />
                        <span className="inbox-empty-orb secondary" />
                        <span className="inbox-empty-card">
                          <strong>Thread masih kosong</strong>
                          <small>Balasan admin pertama akan membuka percakapan dengan member ini.</small>
                        </span>
                      </div>
                      <div className="inbox-empty-copy">
                        <h3>Percakapan masih kosong</h3>
                        <p>Member ini belum mengirim pesan. Admin bisa mulai menghubungi lewat kolom balasan di bawah.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="chat-stack inbox-chat-stack">
                      {activeConversation.thread.map((item, index) => {
                        const mine = item.pengirim_id === user?.id;
                        const currentLabel = getDayDividerLabel(item.waktu_kirim);
                        const previousLabel =
                          index > 0
                            ? getDayDividerLabel(activeConversation.thread[index - 1].waktu_kirim)
                            : null;
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
                                <strong>{mine ? 'Admin' : activeConversation.member.nama}</strong>
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

                <div className="message-form premium-message-form inbox-reply-form">
                  <div className="panel-toolbar">
                    <div>
                      <h3>Balas pesan</h3>
                      <p>Tulis balasan dengan format yang jelas agar member mudah mengikuti arahan admin.</p>
                    </div>
                    <span className="table-chip subtle">Balasan aktif</span>
                  </div>
                  <textarea
                    value={drafts[activeConversation.member.id] ?? ''}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [activeConversation.member.id]: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder={`Balas pesan untuk ${activeConversation.member.nama}`}
                  />
                  <div className="inbox-reply-actions">
                    <button type="button" className="button-primary" onClick={handleReply}>
                      Kirim Balasan
                    </button>
                    <small>Pesan admin akan muncul di sisi kanan seperti aplikasi chat pada umumnya.</small>
                  </div>
                </div>
              </>
            ) : (
              <div className="inbox-empty-stage compact">
                <div className="inbox-empty-visual">
                  <span className="inbox-empty-orb primary" />
                  <span className="inbox-empty-orb secondary" />
                  <span className="inbox-empty-card">
                    <strong>Pilih percakapan</strong>
                    <small>Thread aktif akan terbuka di panel kanan.</small>
                  </span>
                </div>
                <div className="inbox-empty-copy">
                  <h3>Pilih percakapan</h3>
                  <p>Klik salah satu member di sidebar kiri untuk membuka thread chat.</p>
                </div>
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  );
};
