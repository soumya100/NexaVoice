import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useConversationsQuery,
  useConversationMessagesQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useUpdateReadWatermarkMutation,
  ConversationItem,
  MessageItem,
} from '../../../query/hooks';
import { conversationKeys } from '../../../query/query-keys';
import { executeGraphQL, CREATE_DIRECT_CONVERSATION } from '../../../services/api';
import { toastService } from '../../../services/toast';

export {
  useConversationsQuery,
  useConversationMessagesQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useAddReactionMutation,
  useRemoveReactionMutation,
  useUpdateReadWatermarkMutation,
};
export type { ConversationItem, MessageItem };

export function useCreateDirectConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipientUserId: string) => {
      const res = await executeGraphQL<{ createDirectConversation: ConversationItem }>(
        CREATE_DIRECT_CONVERSATION,
        { recipientUserId },
      );
      return res.createDirectConversation;
    },
    onSuccess: (newConv) => {
      queryClient.setQueryData<ConversationItem[]>(conversationKeys.lists(), (old = []) => {
        if (old.some((c) => c.id === newConv.id)) return old;
        return [newConv, ...old];
      });
      toastService.success('Conversation opened');
    },
  });
}
