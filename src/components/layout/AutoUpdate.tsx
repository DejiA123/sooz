import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { holdUpdates, noteNavigation } from "@/lib/appUpdate";

/**
 * Silent updates (no pop-up): tells `appUpdate` about page changes — a quiet moment to switch to a
 * new version — and holds any switch while a call is on. See src/lib/appUpdate.ts.
 */
export const AutoUpdate = () => {
  const { pathname } = useLocation();
  const { callState } = useCall();

  useEffect(() => (callState === "IDLE" ? undefined : holdUpdates("call")), [callState]);

  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    noteNavigation();
  }, [pathname]);

  return null;
};
