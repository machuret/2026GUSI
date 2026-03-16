import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

// ────────────────────────────────────────────────────────
// Google Drive Service Account client — lazy singleton
// ────────────────────────────────────────────────────────

let _drive: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive {
  if (_drive) return _drive;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !keyRaw) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY env vars"
    );
  }

  // The key can be the full JSON string or just the private_key field
  let privateKey: string;
  try {
    const parsed = JSON.parse(keyRaw);
    privateKey = parsed.private_key ?? keyRaw;
  } catch {
    // Assume it's the raw PEM key with escaped newlines
    privateKey = keyRaw.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  _drive = google.drive({ version: "v3", auth });
  return _drive;
}

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

/** Default folder — set GOOGLE_DRIVE_FOLDER_ID in .env */
export function getRootFolderId(): string {
  return process.env.GOOGLE_DRIVE_FOLDER_ID || "root";
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  parents: string[] | null;
  iconLink: string | null;
  thumbnailLink: string | null;
}

const FILE_FIELDS =
  "id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents, iconLink, thumbnailLink";

function mapFile(f: drive_v3.Schema$File): DriveFile {
  return {
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    size: f.size ?? null,
    createdTime: f.createdTime ?? null,
    modifiedTime: f.modifiedTime ?? null,
    webViewLink: f.webViewLink ?? null,
    webContentLink: f.webContentLink ?? null,
    parents: (f.parents as string[]) ?? null,
    iconLink: f.iconLink ?? null,
    thumbnailLink: f.thumbnailLink ?? null,
  };
}

// ────────────────────────────────────────────────────────
// CRUD Operations
// ────────────────────────────────────────────────────────

/** List files in a folder (default: root folder from env) */
export async function listFiles(opts: {
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
  query?: string;
  orderBy?: string;
}): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  const drive = getDrive();
  const folderId = opts.folderId || getRootFolderId();

  let q = `'${folderId}' in parents and trashed = false`;
  if (opts.query) q += ` and (name contains '${opts.query.replace(/'/g, "\\'")}')`;

  const res = await drive.files.list({
    q,
    pageSize: opts.pageSize || 50,
    pageToken: opts.pageToken || undefined,
    orderBy: opts.orderBy || "modifiedTime desc",
    fields: `nextPageToken, files(${FILE_FIELDS})`,
  });

  return {
    files: (res.data.files ?? []).map(mapFile),
    nextPageToken: res.data.nextPageToken ?? null,
  };
}

/** Get a single file's metadata */
export async function getFile(fileId: string): Promise<DriveFile> {
  const drive = getDrive();
  const res = await drive.files.get({
    fileId,
    fields: FILE_FIELDS,
  });
  return mapFile(res.data);
}

/** Download file content as a string (for text-based files) */
export async function downloadFileContent(fileId: string): Promise<string> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return res.data as string;
}

/** Download file as a buffer (for binary files) */
export async function downloadFileBuffer(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/** Upload a file to Google Drive */
export async function uploadFile(opts: {
  name: string;
  mimeType: string;
  content: Buffer | string;
  folderId?: string;
  description?: string;
}): Promise<DriveFile> {
  const drive = getDrive();
  const folderId = opts.folderId || getRootFolderId();

  const body = typeof opts.content === "string" ? Buffer.from(opts.content) : opts.content;
  const stream = new Readable();
  stream.push(body);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: opts.name,
      mimeType: opts.mimeType,
      parents: [folderId],
      description: opts.description,
    },
    media: {
      mimeType: opts.mimeType,
      body: stream,
    },
    fields: FILE_FIELDS,
  });

  return mapFile(res.data);
}

/** Update file metadata (name, description) */
export async function updateFileMetadata(
  fileId: string,
  opts: { name?: string; description?: string }
): Promise<DriveFile> {
  const drive = getDrive();
  const res = await drive.files.update({
    fileId,
    requestBody: opts,
    fields: FILE_FIELDS,
  });
  return mapFile(res.data);
}

/** Update file content */
export async function updateFileContent(
  fileId: string,
  content: Buffer | string,
  mimeType: string
): Promise<DriveFile> {
  const drive = getDrive();
  const body = typeof content === "string" ? Buffer.from(content) : content;
  const stream = new Readable();
  stream.push(body);
  stream.push(null);

  const res = await drive.files.update({
    fileId,
    media: { mimeType, body: stream },
    fields: FILE_FIELDS,
  });
  return mapFile(res.data);
}

/** Move file to trash */
export async function trashFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
  });
}

/** Permanently delete a file */
export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}

/** Create a folder */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId || getRootFolderId()],
    },
    fields: FILE_FIELDS,
  });
  return mapFile(res.data);
}

/** Share a file (make viewable by anyone with link) */
export async function shareFile(
  fileId: string,
  role: "reader" | "writer" | "commenter" = "reader"
): Promise<string | null> {
  const drive = getDrive();
  await drive.permissions.create({
    fileId,
    requestBody: { role, type: "anyone" },
  });
  const file = await getFile(fileId);
  return file.webViewLink;
}

/** Export a Google Workspace file (Docs, Sheets, etc.) to a different format */
export async function exportFile(
  fileId: string,
  mimeType: string
): Promise<Buffer> {
  const drive = getDrive();
  const res = await drive.files.export(
    { fileId, mimeType },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}
