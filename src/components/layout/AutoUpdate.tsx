import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useCall } from "@/contexts/CallContext";
import { holdUpdates, noteNavigation } from "@/lib/appUpdate";
import { startVisitTracking, trackVisit } from "@/lib/visits";

/**
 * Silent updates (no pop-up) and visit counting: tells `appUpdate` (and the visit counter) about page changes — a quiet moment to switch to a
 * new version — and holds any switch while a call is on. See src/lib/appUpdate.ts.
 */
export const AutoUpdate = () => {
  const { pathname } = useLocation();
  const { callState } = useCall();

  useEffect(() => (callState === "IDLE" ? undefined : holdUpdates("call")), [callState]);

  useEffect(() => { startVisitTracking(); }, []); // visit counting for the admin Visitors page

  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    trackVisit(true);
    noteNavigation();
  }, [pathname]);

  return null;
};
