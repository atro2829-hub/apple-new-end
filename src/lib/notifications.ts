// Notification System for Apple.NET

const NOTIFICATION_PREF_KEY = "applenet_notifications_enabled";
const FCM_TOKEN_KEY = "applenet_fcm_token";

/**
 * Check if notifications are supported in this browser
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Check if user has enabled notifications
 */
export function isNotificationEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(NOTIFICATION_PREF_KEY) === "true";
}

/**
 * Save notification preference
 */
export function setNotificationPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_PREF_KEY, enabled ? "true" : "false");
}

/**
 * Request notification permission from the user
 * Returns the permission status
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  permission: NotificationPermission | "unsupported";
}> {
  if (!isNotificationSupported()) {
    return { granted: false, permission: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === "granted";
    setNotificationPreference(granted);
    return { granted, permission };
  } catch {
    return { granted: false, permission: "denied" };
  }
}

/**
 * Show a local notification using the Notification API
 */
export function showLocalNotification(options: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  onClick?: () => void;
}): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      dir: "rtl",
      lang: "ar",
      tag: options.tag || "applenet-notification",
      data: options.data || {},
      vibrate: [100, 50, 100],
    });

    if (options.onClick) {
      notification.onclick = () => {
        window.focus();
        notification.close();
        options.onClick?.();
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } catch {
    // Notification creation failed silently
  }
}

/**
 * Save FCM token to localStorage (placeholder for future FCM integration)
 */
export function saveFCMToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FCM_TOKEN_KEY, token);
}

/**
 * Get saved FCM token
 */
export function getFCMToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(FCM_TOKEN_KEY);
}

/**
 * Remove FCM token
 */
export function removeFCMToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FCM_TOKEN_KEY);
}

/**
 * Initialize notification system
 * Call this on app startup
 */
export async function initNotifications(): Promise<void> {
  if (!isNotificationSupported()) return;
  
  // If user previously enabled notifications but permission was revoked,
  // update the preference
  if (isNotificationEnabled() && Notification.permission !== "granted") {
    setNotificationPreference(false);
  }
}

/**
 * Register service worker for push notifications
 */
export async function registerPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      return subscription;
    }

    // For future FCM integration, we would create a subscription here
    // with a valid VAPID key
    return null;
  } catch {
    return null;
  }
}

/**
 * Send a test notification (for debugging)
 */
export function sendTestNotification(): void {
  showLocalNotification({
    title: "Apple.NET",
    body: "مرحبًا! الإشعارات تعمل بشكل صحيح ✅",
    tag: "test-notification",
  });
}
