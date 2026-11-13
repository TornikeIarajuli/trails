import "server-only";
import { headers } from "next/headers";
import { checkBasicAuth } from "./basic-auth";
import type { Failure } from "./types";

// Server actions are plain POST endpoints and can be invoked on routes the proxy matcher
// skips (such as /legal/*), so each action re-checks the credentials instead of relying on
// the proxy having run. Returns the refusal to hand back to the caller, or null when the
// request is authorized. It returns rather than throws so the page can show the reason:
// production builds replace a thrown error's message with a generic one.
export async function requireAdmin(): Promise<Failure | null> {
  const result = await checkBasicAuth((await headers()).get("authorization"));
  if (result === "ok") return null;
  return { error: result === "not_configured" ? "Admin authentication is not configured" : "Unauthorized" };
}
