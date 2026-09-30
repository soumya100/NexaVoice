import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactKeys } from '../../../query/query-keys';
import {
  executeGraphQL,
  GET_CONTACTS,
  SEND_CONTACT_REQUEST,
  DISCOVER_USERS,
  GET_CONTACT_GROUPS_QUERY,
  CREATE_CONTACT_GROUP_MUTATION,
  GET_ORGANIZATION_DIRECTORY_QUERY,
  TOGGLE_FAVORITE_CONTACT_MUTATION,
} from '../../../services/api';
import { toastService } from '../../../services/toast';

export interface ContactUserSummary {
  id: string;
  nexaVoiceId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isOnline: boolean;
}

export interface ContactRelationship {
  id: string;
  contactUserId: string;
  status: string;
  alias?: string;
  isFavorite: boolean;
  notes?: string;
  createdAt: string;
  contactUser: ContactUserSummary;
}

export interface ContactGroupMember {
  id: string;
  groupId: string;
  contactUserId: string;
  contactUser: ContactUserSummary;
}

export interface ContactGroup {
  id: string;
  userId: string;
  name: string;
  color?: string;
  members: ContactGroupMember[];
}

export interface OrganizationMember {
  id: string;
  nexaVoiceId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
  organizationId?: string;
  presenceStatus: string;
  availability: string;
}

export function useContacts() {
  const queryClient = useQueryClient();

  const contactsQuery = useQuery<ContactRelationship[]>({
    queryKey: contactKeys.list(),
    queryFn: async () => {
      const res = await executeGraphQL<{ contacts: ContactRelationship[] }>(GET_CONTACTS);
      return res.contacts;
    },
    staleTime: 30000,
  });

  const groupsQuery = useQuery<ContactGroup[]>({
    queryKey: contactKeys.groups(),
    queryFn: async () => {
      const res = await executeGraphQL<{ contactGroups: ContactGroup[] }>(GET_CONTACT_GROUPS_QUERY);
      return res.contactGroups;
    },
    staleTime: 30000,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (input: { targetUserId: string; note?: string }) => {
      await executeGraphQL(SEND_CONTACT_REQUEST, { input });
    },
    onSuccess: () => {
      toastService.success('Contact request sent');
      queryClient.invalidateQueries({ queryKey: contactKeys.requests() });
    },
    onError: (err: any) => {
      toastService.error(err.message || 'Failed to send contact request');
    },
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ contactUserId, isFavorite }: { contactUserId: string; isFavorite: boolean }) => {
      await executeGraphQL(TOGGLE_FAVORITE_CONTACT_MUTATION, { contactUserId, isFavorite });
      return { contactUserId, isFavorite };
    },
    onSuccess: ({ contactUserId, isFavorite }) => {
      queryClient.setQueryData<ContactRelationship[]>(contactKeys.list(), (old = []) =>
        old.map((c) => (c.contactUserId === contactUserId ? { ...c, isFavorite } : c)),
      );
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const res = await executeGraphQL<{ createContactGroup: ContactGroup }>(
        CREATE_CONTACT_GROUP_MUTATION,
        { input },
      );
      return res.createContactGroup;
    },
    onSuccess: () => {
      toastService.success('Group created');
      queryClient.invalidateQueries({ queryKey: contactKeys.groups() });
    },
  });

  return {
    contacts: contactsQuery.data ?? [],
    groups: groupsQuery.data ?? [],
    isLoading: contactsQuery.isLoading || groupsQuery.isLoading,
    sendRequest: (targetUserId: string, note?: string) =>
      sendRequestMutation.mutateAsync({ targetUserId, note }),
    toggleFavorite: (contactUserId: string, isFavorite: boolean) =>
      toggleFavoriteMutation.mutateAsync({ contactUserId, isFavorite }),
    createGroup: (name: string, color?: string) =>
      createGroupMutation.mutateAsync({ name, color }),
  };
}

export function useDirectory(filters?: { department?: string; jobTitle?: string; search?: string }) {
  return useQuery<OrganizationMember[]>({
    queryKey: contactKeys.directory(filters),
    queryFn: async () => {
      const res = await executeGraphQL<{ organizationDirectory: OrganizationMember[] }>(
        GET_ORGANIZATION_DIRECTORY_QUERY,
        { input: filters || {} },
      );
      return res.organizationDirectory;
    },
    staleTime: 60000,
  });
}

export function useDiscoverUsers(searchQuery: string) {
  return useQuery<ContactUserSummary[]>({
    queryKey: ['contacts', 'discover', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.trim().length < 2) return [];
      const res = await executeGraphQL<{ discoverUsers: Array<{ user: ContactUserSummary }> }>(
        DISCOVER_USERS,
        { query: searchQuery },
      );
      return res.discoverUsers.map((d) => d.user);
    },
    enabled: searchQuery.trim().length >= 2,
    staleTime: 10000,
  });
}
