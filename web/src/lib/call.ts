import type { Result } from "./types";

export const REQUEST_FAILED =
  "The request did not reach the server or was refused. Check your connection, reload the page and try again.";

// A server action rejects (instead of returning an error) when the network fails, the
// sign-in is refused, or the platform turns the request away, e.g. an oversized upload.
export async function call<T>(action: Promise<Result<T>>, message = REQUEST_FAILED): Promise<Result<T>> {
  try {
    return await action;
  } catch {
    return { error: message };
  }
}
