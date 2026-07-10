import { Platform } from 'react-native';

/**
 * Copy text to the system clipboard.
 *
 * No new dependency on purpose. `expo-clipboard` would work, but the app ships
 * as a web export (ADR-0011) and adding a native module to the bundle to reach
 * an API the browser already exposes is a bad trade.
 *
 * `navigator.clipboard.writeText` is async, requires a secure context, and needs
 * the call to happen inside a user gesture. The `execCommand` path is the
 * fallback for older Safari and for pages served over plain http (a LAN preview,
 * for instance), where `navigator.clipboard` is simply undefined.
 *
 * Returns false rather than throwing: a copy button that explodes is worse than
 * a copy button that says "couldn't copy".
 */
export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through: permission denied, insecure context, or a Safari quirk.
  }

  try {
    const el = document.createElement('textarea');
    el.value = text;
    // Keep it off-screen without `display: none`, which makes it unselectable.
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '-1000px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
