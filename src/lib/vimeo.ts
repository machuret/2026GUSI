/**
 * Vimeo API helper — uses personal access token for authentication.
 * Docs: https://developer.vimeo.com/api/reference
 */

const VIMEO_BASE = "https://api.vimeo.com";

function getToken(): string {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) throw new Error("VIMEO_ACCESS_TOKEN is not configured");
  return token;
}

interface VimeoResponse<T> {
  total: number;
  page: number;
  per_page: number;
  paging: { next: string | null; previous: string | null };
  data: T[];
}

export interface VimeoVideo {
  uri: string; // e.g. "/videos/123456"
  name: string;
  description: string | null;
  link: string;
  duration: number; // seconds
  width: number;
  height: number;
  created_time: string;
  modified_time: string;
  status: string;
  pictures: {
    sizes: { width: number; height: number; link: string }[];
  };
  embed: { html: string };
  tags: { name: string }[];
}

/** Extract the numeric Vimeo ID from the URI (e.g. "/videos/123456" → "123456") */
export function extractVimeoId(uri: string): string {
  return uri.replace("/videos/", "");
}

/** Get the best thumbnail URL from Vimeo pictures */
export function getBestThumbnail(pictures: VimeoVideo["pictures"]): string {
  if (!pictures?.sizes?.length) return "";
  // Pick the largest thumbnail ≤ 640px wide, or the last one
  const sorted = [...pictures.sizes].sort((a, b) => b.width - a.width);
  return (sorted.find((s) => s.width <= 640) ?? sorted[sorted.length - 1]).link;
}

/**
 * Fetch all videos from the authenticated Vimeo account.
 * Handles pagination automatically.
 */
export async function fetchAllVimeoVideos(): Promise<VimeoVideo[]> {
  const token = getToken();
  const all: VimeoVideo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${VIMEO_BASE}/me/videos?per_page=${perPage}&page=${page}&fields=uri,name,description,link,duration,width,height,created_time,modified_time,status,pictures.sizes,embed.html,tags.name`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Vimeo API error ${res.status}: ${text}`);
    }

    const body: VimeoResponse<VimeoVideo> = await res.json();
    all.push(...body.data);

    if (!body.paging.next || body.data.length < perPage) break;
    page++;
  }

  return all;
}

/**
 * Fetch a single video by Vimeo ID.
 */
export async function fetchVimeoVideo(vimeoId: string): Promise<VimeoVideo> {
  const token = getToken();
  const url = `${VIMEO_BASE}/videos/${vimeoId}?fields=uri,name,description,link,duration,width,height,created_time,modified_time,status,pictures.sizes,embed.html,tags.name`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vimeo API error ${res.status}: ${text}`);
  }

  return res.json();
}
