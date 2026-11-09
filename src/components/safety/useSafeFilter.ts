import { useCallback, useEffect, useState } from "react";
import { unsafeText, useFamilySafe } from "@/lib/familySafe";
import { isHiddenLocally, reportedItems, type ReportTargetType } from "@/services/api/safety";

/**
 * Whether a comment / item may be shown: never what this person reported; in family-safe mode, also
 * nothing with strong language or adult themes and nothing with an open report. `refresh()` after
 * reporting something.
 */
export function useSafeFilter() {
  const family = useFamilySafe();
  const [reported, setReported] = useState<Set<string> | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!family) return;
    let live = true;
    reportedItems().then((s) => { if (live) setReported(s); });
    return () => { live = false; };
  }, [family]);
  const allowed = useCallback((type: ReportTargetType, id: string, text?: string | null) => {
    void version;
    if (isHiddenLocally(type, id)) return false;
    if (!family) return true;
    if (unsafeText(text)) return false;
    return !reported?.has(`${type}:${id}`);
  }, [family, reported, version]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { allowed, refresh };
}
