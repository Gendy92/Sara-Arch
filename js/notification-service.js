// Browser notification helper: permission, show, schedule, cancel.
// Falls back to UI.toast when the Notification API is unavailable or denied.

// eslint-disable-next-line no-unused-vars
const NotificationService = {
  _timers: {},

  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch (e) {
      return 'denied';
    }
  },

  async show(title, options = {}) {
    if (!title) return null;
    const body = options.body || '';
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        return new Notification(title, {
          icon: options.icon || '/logo.png',
          tag: options.tag || '',
          requireInteraction: options.requireInteraction || false,
          ...options,
          body
        });
      } catch (e) {
        // fall through to toast
      }
    }
    if (typeof UI !== 'undefined' && UI.toast) {
      const message = body ? `${title} — ${body}` : title;
      UI.toast(message, options.severity || 'info');
    }
    return null;
  },

  schedule({ tag, title, body, delay, severity, icon, requireInteraction }) {
    if (!tag || typeof delay !== 'number') return;
    this.cancel(tag);
    const id = setTimeout(() => {
      delete this._timers[tag];
      this.show(title, { body, tag, severity, icon, requireInteraction });
    }, delay);
    this._timers[tag] = id;
  },

  cancel(tag) {
    if (this._timers[tag]) {
      clearTimeout(this._timers[tag]);
      delete this._timers[tag];
    }
  },

  cancelAll() {
    Object.keys(this._timers).forEach((tag) => this.cancel(tag));
  }
};

if (typeof window !== 'undefined') {
  window.NotificationService = NotificationService;
}
