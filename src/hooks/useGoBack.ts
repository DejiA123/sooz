import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Back button for a page: the previous screen in SOOZ when there is one, otherwise `fallback`
 * (e.g. the page was opened from a notification or a shared link, where "back" would leave the app).
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0; // React Router's position
    if (idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}
