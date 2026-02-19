/**
 * Typed fetch wrapper that always extracts the server error message from the
 * response body. Throws an Error with a human-readable message on non-2xx.
 */
export async function fetchJSON<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Could not reach the server — check your internet connection");
  }

  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON body — fall through to status-based message
  }

  if (!res.ok) {
    const serverMsg = typeof body.error === "string" ? body.error : null;
    const fallback = statusMessage(res.status);
    throw new Error(serverMsg || fallback);
  }

  return body as T;
}

function statusMessage(status: number): string {
  switch (status) {
    case 400: return "Invalid request — check your inputs and try again";
    case 401: return "You are not logged in — please refresh the page";
    case 403: return "You don't have permission to do this";
    case 404: return "The requested resource was not found";
    case 429: return "Too many requests — please wait a moment and try again";
    case 500: return "Server error — please try again or contact support";
    case 502:
    case 503: return "Service temporarily unavailable — please try again shortly";
    default:  return `Unexpected error (HTTP ${status})`;
  }
}
