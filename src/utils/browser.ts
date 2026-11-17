export const FACEBOOK_GROUP_URL = 'https://www.facebook.com/groups/chakoshbackup';

const FB_EXT_QUERY_PARAM = 'fb_ext';
const FB_EXT_SESSION_KEY = 'chakosh_fb_ext_attempted';

export function isFacebookInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBMD|FBSN|Messenger/i.test(ua);
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

function buildAndroidExternalIntentUrl(rawUrl: string): string | null {
  try {
    const targetUrl = new URL(rawUrl);
    targetUrl.searchParams.delete(FB_EXT_QUERY_PARAM);

    const fallbackUrl = new URL(targetUrl.toString());
    fallbackUrl.searchParams.set(FB_EXT_QUERY_PARAM, '1');

    const scheme = targetUrl.protocol.replace(':', '') || 'https';
    const urlWithoutScheme = `${targetUrl.host}${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

    return `intent://${urlWithoutScheme}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(
      fallbackUrl.toString()
    )};end`;
  } catch {
    return null;
  }
}

/**
 * Automatically attempts once on Android Facebook/Messenger in-app browser load
 * to hand off the page to the user's external default browser via Android Intent.
 * Guarded by sessionStorage and query parameter to prevent infinite redirect loops.
 */
export function attemptAutoOpenExternalBrowserFromFacebook(): boolean {
  if (typeof window === 'undefined') return false;
  if (!isFacebookInAppBrowser() || !isAndroidDevice()) return false;

  // Never attempt top-level redirect from inside an embedded preview iframe
  if (window.self !== window.top) return false;

  try {
    const parsed = new URL(window.location.href);
    if (parsed.searchParams.get(FB_EXT_QUERY_PARAM) === '1') {
      return false;
    }
    if (window.sessionStorage.getItem(FB_EXT_SESSION_KEY) === '1') {
      return false;
    }
    window.sessionStorage.setItem(FB_EXT_SESSION_KEY, '1');
  } catch {
    // Continue if storage/URL checks throw
  }

  const intentUrl = buildAndroidExternalIntentUrl(window.location.href);
  if (!intentUrl) return false;

  window.location.href = intentUrl;
  return true;
}

/**
 * Best-effort attempt to open the current URL in an external browser when clicked.
 * Note: iOS Facebook WebView blocks websites from programmatically launching Safari;
 * Android supports safe Intent fallback URLs when triggered by a user tap.
 */
export function attemptOpenInExternalBrowser(): 'android-intent' | 'window-open' | 'ios-manual' {
  if (typeof window === 'undefined') return 'ios-manual';

  if (isIOSDevice() && isFacebookInAppBrowser()) {
    return 'ios-manual';
  }

  const currentUrl = window.location.href;

  if (isAndroidDevice()) {
    const intentUrl = buildAndroidExternalIntentUrl(currentUrl);
    if (intentUrl) {
      window.location.href = intentUrl;
      return 'android-intent';
    }
  }

  try {
    const link = document.createElement('a');
    link.href = currentUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    // Ignore popup blocker errors
  }
  return 'window-open';
}
