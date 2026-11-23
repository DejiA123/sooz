/**
 * Share text on WhatsApp. On phones this opens the WhatsApp app itself (`whatsapp://send`): the web
 * link (wa.me) opened from the installed iPhone app shows up in a pop-up browser that hands over to
 * WhatsApp and then stays behind as a blank white page when people come back (owner's report). If the
 * phone has no WhatsApp (nothing happens), the web link opens after a moment instead. Computers use the
 * web link (WhatsApp Web / desktop).
 */
export function shareOnWhatsApp(text: string) {
  const enc = encodeURIComponent(text);
  const web = `https://wa.me/?text=${enc}`;
  const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (!phone) { window.open(web, "_blank", "noopener"); return; }
  let left = false;
  const away = () => { left = true; };
  const onVis = () => { if (document.visibilityState === "hidden") away(); };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", away);
  window.addEventListener("blur", away);
  window.location.href = `whatsapp://send?text=${enc}`;
  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", away);
    window.removeEventListener("blur", away);
    if (!left && document.visibilityState === "visible") window.open(web, "_blank", "noopener");
  }, 1600);
}
