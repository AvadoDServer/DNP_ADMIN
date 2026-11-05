import { useEffect, useState } from "react";

/**
 * The phone or browser the Admin runs in: installed to the home screen or
 * not, which platform (for the "Add to Home Screen" words), and Chrome's
 * install prompt. Also registers the service worker (public/sw.js).
 */

const nav = () => (typeof navigator !== "undefined" ? navigator : {});
const win = () => (typeof window !== "undefined" ? window : {});

export function platform(ua = nav().userAgent || "", maxTouchPoints = nav().maxTouchPoints || 0) {
  // iPadOS reports itself as a Mac; a touch screen gives it away
  if (/iPhone|iPod/.test(ua)) return "iphone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return "ipad";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

export const isApple = (p = platform()) => p === "iphone" || p === "ipad";
export const isPhone = (p = platform()) => p !== "desktop";

/** Opened from the home screen (installed app), not a browser tab */
export function isStandalone(w = win()) {
  try {
    if (w.navigator && w.navigator.standalone === true) return true; // iOS
    return Boolean(w.matchMedia && w.matchMedia("(display-mode: standalone)").matches);
  } catch (e) {
    return false;
  }
}

/** A short name for the device list on the box ("iPhone", "Chrome on Mac") */
export function deviceName(ua = nav().userAgent || "", maxTouchPoints = nav().maxTouchPoints || 0) {
  const p = platform(ua, maxTouchPoints);
  if (p === "iphone") return "iPhone";
  if (p === "ipad") return "iPad";
  if (p === "android") return "Android phone";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "computer";
  return `${browser} on ${os}`;
}

/* ---------------- Chrome's install prompt ---------------- */

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(l => l(deferredPrompt));

if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

/** Chrome's install prompt when the browser offers one, else null */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(deferredPrompt);
  useEffect(() => {
    listeners.add(setPrompt);
    return () => listeners.delete(setPrompt);
  }, []);
  return prompt;
}

/** Shows Chrome's own install dialog; resolves true when installed */
export async function promptInstall() {
  const p = deferredPrompt;
  if (!p) return false;
  deferredPrompt = null;
  notify();
  await p.prompt();
  const choice = await p.userChoice;
  return Boolean(choice && choice.outcome === "accepted");
}

/* ---------------- service worker ---------------- */

/** Push alerts and installing need a secure page and a service worker */
export function pushSupported(w = win()) {
  return Boolean(w.isSecureContext && w.navigator && "serviceWorker" in w.navigator && "PushManager" in w && "Notification" in w);
}

/**
 * Registers /sw.js on the secure address. On http://my.ava.do a browser
 * allows no service worker, so nothing happens there.
 */
export function registerServiceWorker(w = win()) {
  if (!w.isSecureContext || !w.navigator || !("serviceWorker" in w.navigator)) return Promise.resolve(null);
  return w.navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(e => {
    console.warn(`Service worker not registered: ${e && e.message}`);
    return null;
  });
}

// Tests only
export function _setDeferredPrompt(p) {
  deferredPrompt = p;
  notify();
}
