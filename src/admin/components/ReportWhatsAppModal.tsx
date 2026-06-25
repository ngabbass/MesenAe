import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Edit2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportWhatsAppModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  onSend: () => void;
  onEdit: (newMessage: string) => void;
}

const formatWaText = (text: string) => {
  if (!text) return { __html: '' };
  const formatted = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~(.*?)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br />');
  return { __html: formatted };
};

export default function ReportWhatsAppModal({
  isOpen,
  message,
  onClose,
  onSend,
  onEdit,
}: ReportWhatsAppModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessage, setEditedMessage] = useState(message);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setEditedMessage(message); }, [message]);

  if (!mounted || !isOpen) return null;

  const handleSave = () => {
    onEdit(editedMessage);
    setIsEditing(false);
  };

  const handleSend = () => {
    if (isEditing) {
      onEdit(editedMessage);
      setTimeout(() => onSend(), 50);
    } else {
      onSend();
    }
  };

  const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-[480px] max-h-[92dvh] sm:max-h-[85dvh] bg-white dark:bg-[#111b21] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* WA Header */}
        <div className="bg-[#00a884] px-4 py-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Kirim Laporan via WhatsApp</p>
              <p className="text-[11px] text-white/80">{isEditing ? 'Mode Edit Pesan' : 'Pratinjau Pesan'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isEditing ? 'bg-white dark:bg-[#111b21]' : 'bg-[#efeae2] dark:bg-[#0b141a]'}`}>
          {isEditing ? (
            <div className="flex-1 flex flex-col">
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-[11px] px-4 py-2.5 flex items-center gap-2 border-b border-amber-200 dark:border-amber-800/30 shrink-0">
                <span className="text-base">💡</span>
                <span>Gunakan <b>*teks*</b> untuk tebal, <b>_teks_</b> untuk miring</span>
              </div>
              <textarea
                value={editedMessage}
                onChange={e => setEditedMessage(e.target.value)}
                className="flex-1 w-full p-4 bg-transparent text-gray-900 dark:text-[#e9edef] outline-none resize-none text-[14px] leading-relaxed font-mono"
                placeholder="Ketik pesan..."
                autoFocus
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
              <div className="w-full max-w-[92%] self-end mt-auto">
                <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] p-3 rounded-[14px] rounded-tr-none shadow-sm relative">
                  <div className="absolute top-0 -right-2 w-3 h-4 overflow-hidden">
                    <div className="w-4 h-4 bg-[#d9fdd3] dark:bg-[#005c4b] rounded-bl-sm transform -rotate-45 -translate-y-2 translate-x-1" />
                  </div>
                  <div
                    className="text-[13px] leading-[1.5] whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={formatWaText(editedMessage)}
                  />
                  <div className="flex items-center justify-end gap-1 mt-1.5 float-right">
                    <span className="text-[11px] text-gray-500 dark:text-white/50">{currentTime}</span>
                    <svg viewBox="0 0 16 15" width="14" height="14" className="fill-[#53bdeb]">
                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                    </svg>
                  </div>
                  <div className="clear-both" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-3 shrink-0 flex gap-2.5 border-t border-gray-200 dark:border-gray-700/50"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
          {isEditing ? (
            <>
              <Button variant="outline" className="flex-1 h-11" onClick={() => { setIsEditing(false); setEditedMessage(message); }}>
                Batal
              </Button>
              <Button className="flex-1 h-11 bg-[#00a884] hover:bg-[#008f6f] text-white" onClick={handleSave}>
                Simpan
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1 h-11 gap-2" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
              <Button className="flex-1 h-11 gap-2 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold" onClick={handleSend}>
                <Send className="w-4 h-4" /> Kirim WA
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
