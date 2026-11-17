export const FACEBOOK_GROUP_URL = 'https://www.facebook.com/groups/chakoshbackup';

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

/**
 * Best-effort attempt to open the current URL in an external browser.
 * Note: iOS Facebook WebView does not allow websites to force Safari open programmatically;
 * Android supports safe Intent fallback URLs when triggered by a user click.
 */
export function attemptOpenInExternalBrowser(): 'android-intent' | 'window-open' | 'ios-manual' {
  if (typeof window === 'undefined') return 'ios-manual';

  if (isIOSDevice() && isFacebookInAppBrowser()) {
    return 'ios-manual';
  }

  const currentUrl = window.location.href;

  if (isAndroidDevice()) {
    try {
      const parsed = new URL(currentUrl);
      const scheme = parsed.protocol.replace(':', '') || 'https';
      const urlWithoutScheme = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
      const intentUrl = `intent://${urlWithoutScheme}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(
        currentUrl
      )};end`;
      window.location.href = intentUrl;
      return 'android-intent';
    } catch {
      // Fall through to window.open
    }
  }

  try {
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  } catch {
    // Ignore popup blocker errors
  }
  return 'window-open';
}
