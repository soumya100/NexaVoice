import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Phone,
  PhoneMissed,
  MessageSquare,
  Sparkles,
  UserPlus,
  Sliders,
  X,
} from 'lucide-react';
import { useNotifications, NotificationItem } from '../hooks/useNotifications';

interface NotificationCenterProps {
  onNavigateToConversation?: (conversationId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNavigateToConversation,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UNREAD' | 'CALLS' | 'AI'>('ALL');
  const [showPreferences, setShowPreferences] = useState(false);

  const {
    notifications,
    unreadCount,
    preferences,
    markAsRead,
    markAllAsRead,
    updatePreferences,
  } = useNotifications();

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'UNREAD') return !item.isRead;
    if (activeTab === 'CALLS') {
      return item.type === 'CALL_INCOMING' || item.type === 'MISSED_CALL';
    }
    if (activeTab === 'AI') {
      return item.type === 'AI_SUMMARY';
    }
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MISSED_CALL':
        return <PhoneMissed className="w-4 h-4 text-rose-400" />;
      case 'CALL_INCOMING':
        return <Phone className="w-4 h-4 text-emerald-400" />;
      case 'MESSAGE':
        return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'AI_SUMMARY':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'CONTACT_REQUEST':
      case 'CONTACT_ACCEPTED':
        return <UserPlus className="w-4 h-4 text-sky-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all border border-transparent hover:border-slate-700/50"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full animate-pulse shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center sm:absolute sm:inset-auto sm:top-12 sm:right-0 sm:w-96 bg-black/40 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm sm:w-96 max-h-[80vh] flex flex-col bg-slate-900/95 border border-slate-700/70 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-850/50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowPreferences(!showPreferences)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Notification Settings"
                >
                  <Sliders className="w-4 h-4" />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content: Preferences vs Notification List */}
            {showPreferences ? (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Notification Preferences
                </h4>

                <div className="space-y-3 text-sm">
                  <label className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl cursor-pointer">
                    <div>
                      <div className="font-medium text-slate-200">Do Not Disturb</div>
                      <div className="text-xs text-slate-400">Mute all non-urgent alerts</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences?.globalMute ?? false}
                      onChange={(e) => updatePreferences({ globalMute: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl cursor-pointer">
                    <div>
                      <div className="font-medium text-slate-200">Incoming Calls</div>
                      <div className="text-xs text-slate-400">In-app ringers and banners</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences?.callsInApp ?? true}
                      onChange={(e) => updatePreferences({ callsInApp: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl cursor-pointer">
                    <div>
                      <div className="font-medium text-slate-200">Chat Messages</div>
                      <div className="text-xs text-slate-400">Direct and group notifications</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences?.messagesInApp ?? true}
                      onChange={(e) => updatePreferences({ messagesInApp: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl cursor-pointer">
                    <div>
                      <div className="font-medium text-slate-200">Contact Requests</div>
                      <div className="text-xs text-slate-400">Invites and accepted alerts</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences?.contactRequestsInApp ?? true}
                      onChange={(e) => updatePreferences({ contactRequestsInApp: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl cursor-pointer">
                    <div>
                      <div className="font-medium text-slate-200">AI Call Summaries</div>
                      <div className="text-xs text-slate-400">Post-call intelligence alerts</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences?.aiSummariesInApp ?? true}
                      onChange={(e) => updatePreferences({ aiSummariesInApp: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded bg-slate-700 border-slate-600"
                    />
                  </label>
                </div>

                <button
                  onClick={() => setShowPreferences(false)}
                  className="w-full py-2 text-xs font-semibold text-center text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl transition"
                >
                  Back to Notifications
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-slate-800/80 px-2 py-1 bg-slate-900/60 text-xs font-medium">
                  {(['ALL', 'UNREAD', 'CALLS', 'AI'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 rounded-lg text-center transition ${
                        activeTab === tab
                          ? 'text-white bg-slate-800/80 font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab === 'ALL'
                        ? 'All'
                        : tab === 'UNREAD'
                        ? 'Unread'
                        : tab === 'CALLS'
                        ? 'Calls'
                        : 'AI Notes'}
                    </button>
                  ))}
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 max-h-[55vh]">
                  {filteredNotifications.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No notifications found
                    </div>
                  ) : (
                    filteredNotifications.map((notif: NotificationItem) => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 p-3 transition hover:bg-slate-800/40 cursor-pointer ${
                          !notif.isRead ? 'bg-indigo-950/20' : ''
                        }`}
                        onClick={() => {
                          if (!notif.isRead) markAsRead(notif.id);
                          if (notif.dataJson) {
                            try {
                              const parsed = JSON.parse(notif.dataJson);
                              if (parsed.conversationId && onNavigateToConversation) {
                                onNavigateToConversation(parsed.conversationId);
                                setIsOpen(false);
                              }
                            } catch (_) {}
                          }
                        }}
                      >
                        <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notif.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4
                              className={`text-xs font-semibold truncate ${
                                !notif.isRead ? 'text-white' : 'text-slate-300'
                              }`}
                            >
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">
                              {new Date(notif.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{notif.body}</p>
                        </div>

                        {!notif.isRead && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notif.id);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-indigo-300 transition"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
