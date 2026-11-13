import { getErrorMessage, getErrorStatus } from './showError';

/**
 * True when nobody on the team has checked the trail's route yet. A backend that
 * predates trail reviews does not send `reviewed_at` at all; such trails are
 * treated as reviewed so the app does not flag every trail at once.
 */
export function isRouteUnverified(trail: { reviewed_at?: string | null } | null | undefined): boolean {
  return !!trail && trail.reviewed_at === null;
}

export const UNVERIFIED_ROUTE_MESSAGE =
  "This route comes from OpenStreetMap and hasn't been checked by our team yet. Distances and elevation are estimates. If something is wrong, please report it.";

export const TRAIL_REPORT_THANKS = "Thanks — we'll check it.";

/** Message for a failed trail problem report. An older API answers 404 or 400 to it. */
export function trailReportErrorMessage(err: unknown): string {
  const status = getErrorStatus(err);
  if (status === 404 || status === 400) return "Reporting isn't available yet.";
  return getErrorMessage(err, "Couldn't send the report. Please try again.");
}
