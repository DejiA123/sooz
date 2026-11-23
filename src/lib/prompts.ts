/** Invitations that open by themselves ("Get the app", "Join SOOZ") never come within 3 minutes of each other. */
export const PROMPT_GAP_MS = 3 * 60_000;
export const notePromptShown = () => { try { sessionStorage.setItem("sooz-last-prompt", String(Date.now())); } catch { /* storage blocked */ } };
export const promptShownRecently = () => { try { return Date.now() - (Number(sessionStorage.getItem("sooz-last-prompt")) || 0) < PROMPT_GAP_MS; } catch { return false; } };
