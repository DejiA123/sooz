type NetworkInformationLike = { saveData?: boolean; effectiveType?: string };

/** True on data-saver or 2G connections, where we avoid downloading anything not needed right now. */
export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return !!c && (!!c.saveData || /(^|-)2g$/.test(c.effectiveType || ""));
}
