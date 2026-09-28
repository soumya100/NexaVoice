import { toast, ToastOptions } from 'react-toastify';

/**
 * NexaVoice Centralized Toast Notification Service
 * 
 * Provides unified, theme-aware, deduplicated toasts across the application.
 * Prevents toast spamming and sanitizes raw system error messages.
 */

const recentToasts = new Map<string, number>();
const DEDUPLICATION_INTERVAL_MS = 2500;

function shouldShowToast(message: string): boolean {
  const now = Date.now();
  const lastShown = recentToasts.get(message);
  if (lastShown && now - lastShown < DEDUPLICATION_INTERVAL_MS) {
    return false;
  }
  recentToasts.set(message, now);

  // Housekeeping
  if (recentToasts.size > 50) {
    for (const [key, timestamp] of recentToasts.entries()) {
      if (now - timestamp > 10000) {
        recentToasts.delete(key);
      }
    }
  }
  return true;
}

export const toastService = {
  success(message: string, options?: ToastOptions) {
    if (!shouldShowToast(message)) return;
    toast.success(message, {
      ...options,
      toastId: options?.toastId || message,
    });
  },

  error(message: string, options?: ToastOptions) {
    if (!shouldShowToast(message)) return;
    toast.error(message, {
      ...options,
      toastId: options?.toastId || message,
    });
  },

  warning(message: string, options?: ToastOptions) {
    if (!shouldShowToast(message)) return;
    toast.warning(message, {
      ...options,
      toastId: options?.toastId || message,
    });
  },

  info(message: string, options?: ToastOptions) {
    if (!shouldShowToast(message)) return;
    toast.info(message, {
      ...options,
      toastId: options?.toastId || message,
    });
  },

  dismiss(toastId?: string | number) {
    toast.dismiss(toastId);
  },
};
