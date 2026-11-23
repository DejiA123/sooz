/**
 * Share text on WhatsApp, opening the WhatsApp app itself on phones.
 *
 * Never a web link (wa.me) on iPhone: from the installed app, iOS opens web links in a pop-up browser
 * that hands over to WhatsApp and then stays behind as a blank white page when people come back
 * (owner's report). And no "backup" web link after a delay either: iOS first asks "Open in WhatsApp?",
 * and while that question is up the page still looks unchanged, so a timed backup would open the blank
 * pop-up as well. Android: an intent link, which falls back to the web link by itself if WhatsApp
 * isn't installed. Computers: the web link (WhatsApp Web / desktop).
 */
export function shareOnWhatsApp(text: string) {
  const enc = encodeURIComponent(text);
  const web = `https://wa.me/?text=${enc}`;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) { window.location.href = `whatsapp://send?text=${enc}`; return; }
  if (/Android/i.test(ua)) {
    window.location.href = `intent://send?text=${enc}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${encodeURIComponent(web)};end`;
    return;
  }
  window.open(web, "_blank", "noopener");
}
