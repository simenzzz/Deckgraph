/**
 * Notification state management.
 *
 * Manages notifications from developer hooks and system events.
 */

import { create } from 'zustand';
import type { NotificationMessage } from '@deckgraph/shared';

const MAX_NOTIFICATIONS = 100;
const AUTO_DISMISS_MS = 10_000;

export interface NotificationItem {
  readonly id: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly title: string;
  readonly body: string;
  readonly timestamp: string;
  readonly read: boolean;
}

interface NotificationState {
  notifications: readonly NotificationItem[];
  unreadCount: number;
  addNotification: (msg: NotificationMessage) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (msg) => {
    const notification: NotificationItem = {
      id: msg.requestId,
      severity: msg.severity,
      title: msg.title,
      body: msg.body,
      timestamp: msg.timestamp,
      read: false,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
      unreadCount: state.unreadCount + 1,
    }));

    // Auto-dismiss info notifications after timeout
    if (msg.severity === 'info') {
      setTimeout(() => {
        get().markRead(notification.id);
      }, AUTO_DISMISS_MS);
    }
  },

  markRead: (id) => {
    set((state) => {
      const target = state.notifications.find((n) => n.id === id);
      // Idempotent: skip if already read or not found
      if (!target || target.read) return state;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
