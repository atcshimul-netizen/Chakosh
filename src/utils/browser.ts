export const FACEBOOK_GROUP_URL = 'https://www.facebook.com/groups/chakoshbackup';

export function isFacebookInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBMD|FBSN|Messenger|Instagram/i.test(ua);
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * Constructs a deep-link URL carrying the quiz score, player name, and saved photocard ID.
 * When opened in an external browser, the app opens directly to the result/download screen
 * so the user never has to play the quiz again.
 */
export function buildResultShareUrl(options: {
  score: number;
  playerName?: string;
  resultId?: string;
  backend?: 'express' | 'php';
}): string {
  if (typeof window === 'undefined') return '';
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set('result', '1');
  params.set('score', options.score.toString());
  if (options.playerName && options.playerName.trim()) {
    params.set('name', options.playerName.trim());
  }
  if (options.resultId) {
    params.set('id', options.resultId);
    if (options.backend === 'php') {
      params.set('mode', 'php');
    }
  }
  params.set('auto_popup', '1');
  return `${base}?${params.toString()}`;
}

/**
 * Directly launches the user's external browser (Chrome on Android, or default browser)
 * with the provided URL.
 */
export function openExternalBrowserWithUrl(url: string): void {
  if (typeof window === 'undefined' || !url) return;

  if (isAndroidDevice()) {
    try {
      const targetUrl = new URL(url);
      const scheme = targetUrl.protocol.replace(':', '') || 'https';
      const hostAndPath = `${targetUrl.host}${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

      // Intent targeting Google Chrome on Android with fallback URL
      const intentUrl = `intent://${hostAndPath}#Intent;scheme=${scheme};package=com.android.chrome;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(
        url
      )};end`;

      window.location.href = intentUrl;
      return;
    } catch {}
  }

  // Fallback for non-Android / iOS
  try {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    window.location.href = url;
  }
}

/**
 * Directly opens the Facebook group inside the official Facebook mobile app.
 * - On Android: targets the Facebook app package directly via fb scheme intent.
 * - On iOS: uses the fb:// scheme.
 * - In Facebook/Instagram in-app browser: uses fb://facewebmodal to switch natively to the group.
 * - Desktop: standard browser navigation.
 * 
 * Note: Avoids secondary timeouts or S.browser_fallback_url that cause mobile browsers
 * to open both the Facebook app and a duplicate Facebook Web tab simultaneously.
 */
export function openFacebookGroup(): void {
  if (typeof window === 'undefined') return;

  const groupUrl = FACEBOOK_GROUP_URL;

  // 1. Inside Facebook / Messenger / Instagram in-app browser:
  // Native switch to group view without navigating webview away
  if (isFacebookInAppBrowser()) {
    try {
      window.location.href = `fb://facewebmodal/f?href=${encodeURIComponent(groupUrl)}`;
      return;
    } catch {}
  }

  // 2. On Android mobile (Chrome or other browsers):
  // Launch the Facebook app directly using scheme=fb so Chrome does NOT also navigate the browser tab to Facebook Web
  if (isAndroidDevice()) {
    try {
      const intentUrl = `intent://facewebmodal/f?href=${encodeURIComponent(
        groupUrl
      )}#Intent;scheme=fb;package=com.facebook.katana;end`;
      window.location.href = intentUrl;
      return;
    } catch {}
  }

  // 3. On iOS mobile (Safari or other browsers):
  // Launch the Facebook app directly using fb:// scheme without duplicate web reload
  if (isIOSDevice()) {
    try {
      window.location.href = `fb://facewebmodal/f?href=${encodeURIComponent(groupUrl)}`;
      return;
    } catch {}
  }

  // 4. Standard Desktop / Fallback browser redirect
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = groupUrl;
      return;
    }
  } catch {}

  try {
    window.location.href = groupUrl;
  } catch {
    window.location.assign(groupUrl);
  }
}
