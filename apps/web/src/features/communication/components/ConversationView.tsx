import React, { useState, useRef, useEffect } from 'react';
import { Phone, Video, MessageSquare } from 'lucide-react';
import {
  ConversationItem,
  MessageItem as MessageData,
  useConversationMessagesQuery,
  useSendMessageMutation,
  useAddReactionMutation,
  useDeleteMessageMutation,
  useUpdateReadWatermarkMutation,
} from '../hooks/useConversations';
import { MessageItemComponent } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { authService } from '../../../services/auth';
import { realtimeClient } from '../../../services/realtime';

interface ConversationViewProps {
  conversation: ConversationItem;
  onStartCall: (targetUserId: string, callType: 'VOICE' | 'VIDEO', conversationId?: string) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  onStartCall,
}) => {
  const currentUserId = authService.getUser()?.id || '';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);

  const { data: messages = [], isLoading } = useConversationMessagesQuery(conversation.id);
  const sendMessageMutation = useSendMessageMutation();
  const addReactionMutation = useAddReactionMutation();
  const deleteMessageMutation = useDeleteMessageMutation();
  const updateWatermarkMutation = useUpdateReadWatermarkMutation();

  // Inform realtimeClient about active conversation
  useEffect(() => {
    realtimeClient.setActiveConversation(conversation.id);
    realtimeClient.joinConversation(conversation.id);

    // Update read watermark
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      if (latest.id) {
        updateWatermarkMutation.mutate({
          input: {
            conversationId: conversation.id,
            messageId: latest.id,
          },
        });
      }
    }

    return () => {
      realtimeClient.setActiveConversation(null);
      realtimeClient.leaveConversation(conversation.id);
    };
  }, [conversation.id, messages.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = async (content: string, _replyToMessageId?: string) => {
    await sendMessageMutation.mutateAsync({
      input: {
        conversationId: conversation.id,
        content,
        clientMessageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      },
    });
  };

  // Find other participant for 1:1 call
  const otherParticipant = conversation.participants?.find((p) => p.userId !== currentUserId);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {conversation.title?.charAt(0).toUpperCase() || 'C'}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{conversation.title || 'Conversation'}</h3>
            <div className="text-[11px] text-slate-400">
              {conversation.type === 'DIRECT' ? 'Direct Message' : `${conversation.participants?.length || 0} participants`}
            </div>
          </div>
        </div>

        {/* Call & Action Buttons */}
        <div className="flex items-center gap-1.5">
          {otherParticipant && (
            <>
              <button
                onClick={() => onStartCall(otherParticipant.userId, 'VOICE', conversation.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 border border-emerald-500/30 rounded-xl transition shadow-sm"
                title="Start Voice Call from Conversation"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Call</span>
              </button>

              <button
                onClick={() => onStartCall(otherParticipant.userId, 'VIDEO', conversation.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-600 border border-violet-500/30 rounded-xl transition shadow-sm"
                title="Start Video Call from Conversation"
              >
                <Video className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Video</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {isLoading ? (
          <div className="py-20 text-center text-xs text-slate-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="py-24 text-center text-slate-500 text-sm">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No messages yet in this conversation</p>
            <p className="text-xs text-slate-600 mt-1">Send a message to start communicating</p>
          </div>
        ) : (
          messages.map((message: MessageData) => (
            <MessageItemComponent
              key={message.id}
              message={message}
              isCurrentUser={message.senderId === currentUserId}
              onReply={(m) => setReplyingTo(m)}
              onAddReaction={(messageId, reaction) =>
                addReactionMutation.mutate({ input: { messageId, reaction } })
              }
              onDelete={(messageId) => deleteMessageMutation.mutate({ input: { messageId } })}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0">
        <MessageComposer
          conversationId={conversation.id}
          onSendMessage={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>
    </div>
  );
};
