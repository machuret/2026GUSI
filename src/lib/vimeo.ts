/**
 * Vimeo API helper — uses personal access token for authentication.
 * Docs: https://developer.vimeo.com/api/reference
 */

const VIMEO_BASE = "https://api.vimeo.com";
const VIDEOS_PER_PAGE = 100;

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

export interface VimeoTextTrack {
  uri: string;
  active: boolean;
  type: string; // "captions", "subtitles"
  language: string;
  link: string; // URL to download the track file
  name: string;
}

/** Extract the numeric Vimeo ID from the URI (e.g. "/videos/123456" → "123456") */
export function extractVimeoId(uri: string): string {
  return uri.replace("/videos/", "");
}

/** Get the best thumbnail URL from Vimeo pictures */
export function getBestThumbnail(pictures: VimeoVideo["pictures"]): string {
  if (!pictures?.sizes?.length) return "";
  const sorted = [...pictures.sizes].sort((a, b) => b.width - a.width);
  return (sorted.find((s) => s.width <= 640) ?? sorted[sorted.length - 1]).link;
}

/**
 * Fetch a single page of videos from the Vimeo account.
 * Returns the page data plus total count for progress tracking.
 */
export async function fetchVimeoPage(page: number): Promise<{
  videos: VimeoVideo[];
  total: number;
  totalPages: number;
  hasMore: boolean;
}> {
  const token = getToken();
  const url = `${VIMEO_BASE}/me/videos?per_page=${VIDEOS_PER_PAGE}&page=${page}&fields=uri,name,description,link,duration,width,height,created_time,modified_time,status,pictures.sizes,embed.html,tags.name`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vimeo API error ${res.status}: ${text}`);
  }

  const body: VimeoResponse<VimeoVideo> = await res.json();
  const totalPages = Math.ceil(body.total / VIDEOS_PER_PAGE);

  return {
    videos: body.data,
    total: body.total,
    totalPages,
    hasMore: !!body.paging.next && body.data.length === VIDEOS_PER_PAGE,
  };
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

/**
 * Fetch text tracks (captions/subtitles) for a video.
 */
export async function fetchVideoTextTracks(vimeoId: string): Promise<VimeoTextTrack[]> {
  const token = getToken();
  const url = `${VIMEO_BASE}/videos/${vimeoId}/texttracks`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
  });

  if (!res.ok) {
    // 404 means no text tracks — not an error
    if (res.status === 404) return [];
    const text = await res.text();
    throw new Error(`Vimeo texttracks error ${res.status}: ${text}`);
  }

  const body = await res.json();
  return body.data ?? [];
}

/**
 * Download the actual transcript/caption content from a text track URL.
 * Returns the raw text content (usually VTT or SRT format).
 */
export async function fetchTranscriptContent(trackUrl: string): Promise<string> {
  const res = await fetch(trackUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch transcript: ${res.status}`);
  }
  return res.text();
}

/**
 * Parse VTT/SRT content into plain text (strip timestamps and formatting).
 */
export function parseTranscriptToText(raw: string): string {
  return raw
    .replace(/WEBVTT[\s\S]*?\n\n/, "") // strip VTT header
    .replace(/\d+\n/g, "") // strip SRT sequence numbers
    .replace(/[\d:.]+\s*-->\s*[\d:.]+\s*\n/g, "") // strip timestamps
    .replace(/<[^>]+>/g, "") // strip HTML tags
    .replace(/\n{3,}/g, "\n\n") // collapse blank lines
    .trim();
}
