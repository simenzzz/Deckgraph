/**
 * Notification panel with bell icon and popover.
 *
 * Displays notifications from developer hooks and system events.
 * Supports marking as read and clearing all notifications.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, Info, AlertTriangle, XCircle } from 'lucide-react';
import { useNotificationStore, type NotificationItem } from '@/stores/notificationStore';

const SEVERITY_ICONS: Record<NotificationItem['severity'], typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationPanel() {
  const { notifications, unreadCount, markRead, markAllRead, clear } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleItemKeyDown = useCallback(
    (id: string, e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        markRead(id);
      }
    },
    [markRead],
  );

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 hover:bg-gray-100"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="absolute right-0 top-12 z-50 w-96 rounded-lg border border-gray-200 bg-white shadow-lg"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead()}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clear()}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Notifications list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No notifications
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {notifications.map((notification) => {
                    const Icon = SEVERITY_ICONS[notification.severity];
                    return (
                      <li
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        className={`cursor-pointer px-4 py-3 hover:bg-gray-50 ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => markRead(notification.id)}
                        onKeyDown={(e) => handleItemKeyDown(notification.id, e)}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4
                                className={`font-medium ${
                                  !notification.read ? 'text-gray-900' : 'text-gray-600'
                                }`}
                              >
                                {notification.title}
                              </h4>
                              <span className="text-xs text-gray-500">
                                {formatRelativeTime(notification.timestamp)}
                              </span>
                            </div>
                            <p
                              className={`mt-1 text-sm whitespace-pre-wrap ${
                                !notification.read ? 'text-gray-700' : 'text-gray-500'
                              }`}
                            >
                              {notification.body}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
