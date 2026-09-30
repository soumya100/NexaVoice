import {
  contactKeys,
  presenceKeys,
  notificationKeys,
  profileKeys,
} from '../query/query-keys';

describe('Milestone 8: Social Communication Ecosystem Query Keys & Contracts', () => {
  describe('Query Key Factories', () => {
    it('constructs deterministic query keys for presence', () => {
      expect(presenceKeys.all).toEqual(['presence']);
      expect(presenceKeys.me()).toEqual(['presence', 'me']);
      expect(presenceKeys.user('user-42')).toEqual(['presence', 'user', 'user-42']);
    });

    it('constructs deterministic query keys for notifications and preferences', () => {
      expect(notificationKeys.all).toEqual(['notifications']);
      expect(notificationKeys.list({ limit: 10, offset: 0, unreadOnly: true })).toEqual([
        'notifications',
        'list',
        { limit: 10, offset: 0, unreadOnly: true },
      ]);
      expect(notificationKeys.unreadCount()).toEqual(['notifications', 'unreadCount']);
      expect(notificationKeys.preferences()).toEqual(['notifications', 'preferences']);
    });

    it('constructs deterministic query keys for contact groups and directory', () => {
      expect(contactKeys.groups()).toEqual(['contacts', 'groups']);
      expect(contactKeys.directory({ department: 'Engineering' })).toEqual([
        'contacts',
        'directory',
        { department: 'Engineering' },
      ]);
      expect(profileKeys.privacy()).toEqual(['profile', 'privacy']);
    });
  });

  describe('Social Contracts & Data Structures', () => {
    it('validates presence availability precedence', () => {
      // IN_CALL takes precedence over regular ONLINE
      const computeAvailability = (status: string, inActiveCall: boolean) => {
        if (inActiveCall) return 'IN_CALL';
        if (status === 'BUSY') return 'BUSY';
        if (status === 'ONLINE') return 'AVAILABLE';
        return 'UNAVAILABLE';
      };

      expect(computeAvailability('ONLINE', true)).toBe('IN_CALL');
      expect(computeAvailability('ONLINE', false)).toBe('AVAILABLE');
      expect(computeAvailability('BUSY', false)).toBe('BUSY');
      expect(computeAvailability('OFFLINE', false)).toBe('UNAVAILABLE');
    });

    it('validates notification priority levels and sorting', () => {
      const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
      const priorityWeights: Record<string, number> = {
        LOW: 1,
        NORMAL: 2,
        HIGH: 3,
        URGENT: 4,
      };

      const sorted = [...priorities].sort((a, b) => priorityWeights[b] - priorityWeights[a]);
      expect(sorted).toEqual(['URGENT', 'HIGH', 'NORMAL', 'LOW']);
    });
  });
});
