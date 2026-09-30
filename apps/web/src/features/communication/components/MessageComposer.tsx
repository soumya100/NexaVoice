import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { MessageItem as MessageData } from '../hooks/useConversations';
import { uploadAttachmentFile } from '../../../services/api';
import { realtimeClient } from '../../../services/realtime';

interface MessageComposerProps {
  conversationId: string;
  onSendMessage: (content: string, replyToMessageId?: string) => Promise<void>;
  replyingTo?: MessageData | null;
  onCancelReply?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversationId,
  onSendMessage,
  replyingTo,
  onCancelReply,
}) => {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Send typing-start
    realtimeClient.sendTypingStart(conversationId);

    // Debounce typing-stop after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      realtimeClient.sendTypingStop(conversationId);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = content.trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      setContent('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        realtimeClient.sendTypingStop(conversationId);
      }
      await onSendMessage(text, replyingTo?.id);
      if (onCancelReply) onCancelReply();
    } catch (_) {
      // rollback or retry
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const attachment = await uploadAttachmentFile(file);
      await onSendMessage(`[Attachment: ${attachment.fileName}]`, replyingTo?.id);
      if (onCancelReply) onCancelReply();
    } catch (err: any) {
      console.error('File upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-3 bg-slate-900/90 border-t border-slate-800/80 backdrop-blur-md">
      {/* Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-850 border border-slate-800 rounded-xl text-xs text-slate-300">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-indigo-400">
              Replying to {replyingTo.sender?.displayName || 'User'}:
            </span>
            <span className="text-slate-400 truncate">{replyingTo.content}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500/70 focus-within:ring-1 focus-within:ring-indigo-500/50 transition">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-900 transition disabled:opacity-50"
          title="Upload file or image"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          rows={1}
          placeholder={isUploading ? 'Uploading file...' : 'Type a message... (Enter to send)'}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isUploading}
          className="flex-1 max-h-32 py-1.5 px-2 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none"
        />

        <button
          type="button"
          onClick={() => handleSend()}
          disabled={!content.trim() || isSending || isUploading}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition shadow-md shadow-indigo-600/20"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
