/**
 * _shared/crawl.ts
 * HTTP web-crawling utility for fetching funder grant pages.
 *
 * Exports:
 *  - crawlUrl — fetches a URL, strips HTML, returns plain text capped at maxChars
 */

/**
 * Fetches a URL and strips HTML tags, returning plain text capped at `maxChars`.
 * Protected by an 8-second `AbortSignal` timeout. Returns an empty string on any
 * failure so callers never need to handle errors from this function.
 *
 * @param url       The URL to fetch. Returns "" immediately if falsy.
 * @param maxChars  Maximum characters to return (default 4 000).
 */
export async function crawlUrl(url: string, maxChars = 4000): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  } catch {
    return "";
  }
}
