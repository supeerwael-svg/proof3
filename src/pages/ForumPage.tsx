import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Send } from 'lucide-react';
import { Header } from '@/components/Header';
import { ForumService, ChatService } from '@/services';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo } from '@/utils/format';
import type { ForumTopicEntity, ForumReplyEntity, ChatRoomEntity, ChatMessageEntity } from '@/types';

export function ForumPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [topics, setTopics] = useState<ForumTopicEntity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [view, setView] = useState<'topics' | 'topic' | 'chat'>('topics');
  const [selectedTopic, setSelectedTopic] = useState<ForumTopicEntity | null>(null);
  const [replies, setReplies] = useState<ForumReplyEntity[]>([]);
  const [replyText, setReplyText] = useState('');

  // Chat state
  const [rooms, setRooms] = useState<ChatRoomEntity[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoomEntity | null>(null);
  const [messages, setMessages] = useState<ChatMessageEntity[]>([]);
  const [msgText, setMsgText] = useState('');

  const loadTopics = () => ForumService.getTopics().then(setTopics);
  useEffect(() => { loadTopics(); ChatService.getRooms().then(setRooms); }, []);

  const canWrite = user?.role === 'super_admin' || user?.role === 'teacher_write';

  const createTopic = async () => {
    if (!title.trim() || !user) return;
    await ForumService.createTopic(title.trim(), content.trim(), [], user.displayName, user.id);
    setTitle(''); setContent(''); setShowForm(false);
    loadTopics();
  };

  const openTopic = async (topic: ForumTopicEntity) => {
    setSelectedTopic(topic);
    setReplies(await ForumService.getReplies(topic.id));
    setView('topic');
  };

  const addReply = async () => {
    if (!replyText.trim() || !selectedTopic || !user) return;
    await ForumService.addReply(selectedTopic.id, replyText.trim(), user.displayName, user.id);
    setReplyText('');
    setReplies(await ForumService.getReplies(selectedTopic.id));
  };

  const openRoom = async (room: ChatRoomEntity) => {
    setSelectedRoom(room);
    setMessages(await ChatService.getMessages(room.id));
    setView('chat');
  };

  const sendMsg = async () => {
    if (!msgText.trim() || !selectedRoom || !user) return;
    await ChatService.sendMessage(selectedRoom.id, user.id, user.displayName, msgText.trim(), user.id);
    setMsgText('');
    setMessages(await ChatService.getMessages(selectedRoom.id));
  };

  if (view === 'topic' && selectedTopic) {
    return (
      <div className="min-h-screen pb-20">
        <Header title={selectedTopic.title} showBack onBack={() => setView('topics')} />
        <div className="max-w-md mx-auto px-4 py-4 space-y-3">
          <div className="card p-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">{selectedTopic.content}</p>
            <p className="text-xs text-slate-400 mt-2">{selectedTopic.authorName} · {timeAgo(selectedTopic.createdAt, lang)}</p>
          </div>
          {replies.map(r => (
            <div key={r.id} className="card p-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">{r.content}</p>
              <p className="text-xs text-slate-400 mt-1">{r.authorName} · {timeAgo(r.createdAt, lang)}</p>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addReply()}
              placeholder={t('addReply')}
              className="input flex-1"
            />
            <button onClick={addReply} className="btn-primary px-3"><Send size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'chat' && selectedRoom) {
    return (
      <div className="min-h-screen pb-20 flex flex-col">
        <Header title={selectedRoom.name} showBack onBack={() => setView('topics')} />
        <div className="flex-1 max-w-md mx-auto w-full px-4 py-4 space-y-2 overflow-y-auto">
          {messages.length === 0 && <p className="text-sm text-slate-400 text-center py-8">{t('typeMessage')}</p>}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-2xl px-4 py-2 max-w-[80%] ${m.senderId === user?.id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                <p className="text-xs font-semibold opacity-70 mb-0.5">{m.senderName}</p>
                <p className="text-sm">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="fixed bottom-16 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 safe-bottom">
          <div className="flex gap-2 px-4 py-2 max-w-md mx-auto">
            <input
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
              placeholder={t('typeMessage')}
              className="input flex-1"
            />
            <button onClick={sendMsg} className="btn-primary px-3"><Send size={18} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Header title={t('forum')} />
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex-1">
            <Plus size={18} /> {t('newTopic')}
          </button>
        </div>

        {showForm && canWrite && (
          <div className="card p-4 space-y-2 animate-slide-up">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('topicTitle')} className="input" />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t('content')} className="input" rows={3} />
            <div className="flex gap-2">
              <button onClick={createTopic} className="btn-primary flex-1">{t('save')}</button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">{t('cancel')}</button>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{t('forum')}</h2>
          {topics.length > 0 ? topics.map(topic => (
            <button key={topic.id} onClick={() => openTopic(topic)} className="card p-4 w-full text-start hover:shadow-md transition-shadow mb-2">
              <div className="flex items-start gap-3">
                <MessageSquare size={20} className="text-primary-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{topic.title}</p>
                  <p className="text-xs text-slate-500 truncate">{topic.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{topic.authorName} · {timeAgo(topic.createdAt, lang)} · {topic.repliesCount} {t('replies')}</p>
                </div>
              </div>
            </button>
          )) : <p className="text-sm text-slate-400 text-center py-4">{t('noTopics')}</p>}
        </div>

        {rooms.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{t('chatRooms')}</h2>
            {rooms.map(room => (
              <button key={room.id} onClick={() => openRoom(room)} className="card p-3 w-full text-start hover:shadow-md transition-shadow mb-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-50 dark:bg-accent-900/20 flex items-center justify-center text-accent-600 dark:text-accent-400 font-bold">
                  {room.name.charAt(0)}
                </div>
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{room.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
