export type AnalyticsEventType =
  | 'visit'
  | 'play'
  | 'complete'
  | 'download'
  | 'share_facebook'
  | 'share_messenger';

export interface AnalyticsStats {
  success: boolean;
  range: '1h' | '6h' | '12h' | '24h' | 'all';
  serverTime: number;
  liveVisitors: number;
  totalVisits: number;
  uniqueVisitors: number;
  plays: number;
  completions: number;
  downloads: number;
  sharesFacebook: number;
  sharesMessenger: number;
  totalShares: number;
  conversionRates: {
    playRate: number;
    completionRate: number;
    downloadRate: number;
    shareRate: number;
  };
  deviceBreakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  recentEvents: Array<{
    event_type: string;
    device_type: string;
    created_at: number;
    metadata: string | null;
  }>;
}

const VISITOR_KEY = 'chk_vid';
const SESSION_KEY = 'chk_sid';
const ADMIN_TOKEN_KEY = 'chk_adm_token';

/**
 * Generate pseudo-random hex string
 */
function randomHex(bytes = 8): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).substring(2, 2 + bytes * 2);
}

/**
 * Get or initialize persistent visitor ID from localStorage
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server_render';
  try {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
      vid = `v_${Date.now().toString(36)}_${randomHex(6)}`;
      localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid;
  } catch {
    return `v_${Date.now().toString(36)}_${randomHex(6)}`;
  }
}

/**
 * Get or initialize session ID from sessionStorage
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server_render';
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${randomHex(6)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `s_${Date.now().toString(36)}_${randomHex(6)}`;
  }
}

/**
 * Resolve the API endpoint url
 */
function getApiEndpoint(action: string, extraQuery = ''): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const query = extraQuery ? `&${extraQuery}` : '';
  return `${base}/api/analytics.php?action=${action}${query}`;
}

/**
 * Track an analytics event
 */
export async function trackEvent(
  event: AnalyticsEventType,
  stage = 'welcome',
  metadata?: Record<string, any>
): Promise<void> {
  if (typeof window === 'undefined') return;

  const payload = {
    event,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    stage,
    metadata: metadata || null,
  };

  try {
    // Use navigator.sendBeacon when available for non-blocking telemetry on page unload
    const url = getApiEndpoint('track');
    const bodyStr = JSON.stringify(payload);

    if (navigator.sendBeacon && event !== 'complete') {
      const blob = new Blob([bodyStr], { type: 'application/json' });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) return;
    }

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: bodyStr,
      keepalive: true,
    });
  } catch (err) {
    // Fail silently so user quiz experience is never disrupted
    console.debug('Analytics track error:', err);
  }
}

export function trackVisit(stage = 'welcome'): void {
  trackEvent('visit', stage);
}

export function trackPlay(): void {
  trackEvent('play', 'quiz');
}

export function trackComplete(score: number, personalityTitle: string): void {
  trackEvent('complete', 'result', { score, title: personalityTitle });
}

export function trackDownload(): void {
  trackEvent('download', 'result');
}

export function trackShareFacebook(): void {
  trackEvent('share_facebook', 'result');
}

export function trackShareMessenger(): void {
  trackEvent('share_messenger', 'result');
}

/**
 * Start heartbeat service for reporting active live visitors
 */
export function startHeartbeat(getCurrentStage: () => string): () => void {
  if (typeof window === 'undefined') return () => {};

  const sendHeartbeat = () => {
    try {
      const url = getApiEndpoint('heartbeat');
      const body = JSON.stringify({
        visitorId: getVisitorId(),
        sessionId: getSessionId(),
        stage: getCurrentStage(),
      });
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  // Immediate ping
  sendHeartbeat();

  // Periodic ping every 30 seconds
  const intervalId = window.setInterval(sendHeartbeat, 30000);

  // Ping on tab visibility change (when user returns to the tab)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

// --------------------------------------------------------------------------
// Admin Portal Authentication & Stats API
// --------------------------------------------------------------------------

export function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {}
}

export function clearStoredAdminToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

export async function adminLogin(
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const url = getApiEndpoint('login');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      setStoredAdminToken(data.token);
      return { success: true, token: data.token };
    }
    return { success: false, error: data.error || 'ভুল ইউজারনেম বা পাসওয়ার্ড।' };
  } catch (err: any) {
    return { success: false, error: err.message || 'সার্ভারে সংযোগ করা সম্ভব হয়নি।' };
  }
}

export async function adminLogout(): Promise<void> {
  clearStoredAdminToken();
  try {
    const url = getApiEndpoint('logout');
    await fetch(url, { method: 'POST' });
  } catch {}
}

export async function adminGetStats(
  range: '1h' | '6h' | '12h' | '24h' | 'all' = '24h',
  token?: string
): Promise<AnalyticsStats> {
  const authToken = token || getStoredAdminToken();
  if (!authToken) {
    throw new Error('দয়া করে এডমিন পোর্টালে লগইন করুন।');
  }

  const url = getApiEndpoint('stats', `range=${range}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredAdminToken();
      throw new Error('সেশনের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে আবার লগইন করুন।');
    }
    let errorMsg = `Server error ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) errorMsg = data.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data: AnalyticsStats = await res.json();
  return data;
}
