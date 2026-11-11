import { queryClient } from "@/lib/react-query";

/**
 * Something on a profile changed (a post deleted / edited, a like, save, repost or follow): refresh the
 * profile header and its Posts / Reposts / Saved / Liked grids straight away, so nobody has to leave and
 * come back to see it.
 */
export function refreshProfiles() {
  queryClient.invalidateQueries({ queryKey: ["profile-tab"] });
  queryClient.invalidateQueries({ queryKey: ["profile"] });
}
