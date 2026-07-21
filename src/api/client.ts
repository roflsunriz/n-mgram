import { isTauri } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { z, ZodError, type ZodType } from 'zod';

const API_BASE_URL = 'https://business.wel.my.id';
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [400, 1_000];
const APP_HEADERS = {
  'x-app-sdk-version': '54.0.0',
  'x-app-version': '5.0.0',
} as const;
const APP_USER_AGENT = 'Nicomanga/5.0.0/sdk/54.0.0Nicomanga';
const MAX_PAGE_IMAGE_BYTES = 32 * 1024 * 1024;
const PAGE_IMAGE_REQUEST_TIMEOUT_MS = 20_000;
const BLOCKED_IMAGE_URL_MARKERS = ['image_5f0ecf23aed2e.png'];
const BLOCKED_IMAGE_DIGESTS = new Set([
  'c0bb95acdefac920e62af2da8d7eef91521d1782a83f80b1b7f9c04ebd3ca008',
]);

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const remoteImageUrl = z.string().refine(isHttpsUrl, 'HTTPS画像URLではありません');
const metadataNumber = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((value) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });

export function isBlockedImageUrl(value: string): boolean {
  const normalized = value.toLowerCase();
  return BLOCKED_IMAGE_URL_MARKERS.some((marker) => normalized.includes(marker));
}

const chapterContentSchema = z
  .array(z.string())
  .transform((values) => values.filter((value) => isHttpsUrl(value) && !isBlockedImageUrl(value)));

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#')) {
      const radix = code.startsWith('#x') ? 16 : 10;
      const digits = code.slice(radix === 16 ? 2 : 1);
      const codePoint = Number.parseInt(digits, radix);
      if (
        !Number.isSafeInteger(codePoint) ||
        codePoint < 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return entity;
      }
      return String.fromCodePoint(codePoint);
    }
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

export function descriptionToPlainText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ')
    .replace(/<\s*\/\s*(?:div|h[1-6]|li|p)\s*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const mangaSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    slug: z.string().default(''),
    authors: z.string().default(''),
    transGroup: z.string().default(''),
    artists: z.string().default(''),
    released: metadataNumber,
    otherName: z.string().default(''),
    genres: z.string().default(''),
    description: z.string().default('').transform(descriptionToPlainText),
    lastUpdate: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    cover: remoteImageUrl,
    lastChapter: z.union([z.string(), z.number()]).transform(String),
    mStatus: metadataNumber,
    views: metadataNumber,
    post: z
      .string()
      .nullish()
      .transform((value) => value ?? ''),
    submitter: metadataNumber,
    groupUploader: metadataNumber,
    hidden: metadataNumber,
    magazines: z.string().default(''),
  })
  .passthrough();

export const chapterSchema = z
  .object({
    mid: z.number().int().positive(),
    name: z.string().min(1),
    chapter: z.number().nonnegative(),
    content: chapterContentSchema,
    time: z.string().default(''),
    views: z.number().default(0),
    cover: remoteImageUrl.optional(),
  })
  .passthrough();

export const mangaListSchema = z.array(mangaSchema);
export const chapterListSchema = z.array(chapterSchema);

export type Manga = z.infer<typeof mangaSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type CollectionSort = 'new' | 'top' | 'update';
export type MangaSearchStatus = 'Any' | 'Ongoing' | 'Completed';

export interface MangaSearchRequest {
  query: string;
  name: string;
  authors: string;
  genres: string[];
  magazines: string;
  status: MangaSearchStatus;
  page: number;
  size: number;
}
type MangaServerSearchRequest = Omit<MangaSearchRequest, 'query' | 'genres'> & {
  genres: Array<{ name: string }>;
};

export interface ResolvedPageImage {
  blocked: boolean;
  source?: string;
  blob?: Blob;
  byteLength?: number;
  revoke?: () => void;
}

export class PageImageError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'PageImageError';
  }
}

export function createAppHeaders(nativeTransport: boolean): Record<string, string> {
  return {
    ...APP_HEADERS,
    ...(nativeTransport ? { 'User-Agent': APP_USER_AGENT } : {}),
  };
}

export type ApiErrorKind =
  'network' | 'timeout' | 'rate-limit' | 'forbidden' | 'server' | 'invalid';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorForStatus(status: number): ApiError {
  if (status === 429)
    return new ApiError(
      'rate-limit',
      'アクセスが集中しています。少し待って再試行してください。',
      status,
    );
  if (status === 401 || status === 403)
    return new ApiError('forbidden', 'APIへのアクセスが拒否されました。', status);
  if (status >= 500) return new ApiError('server', 'APIサーバーで問題が発生しています。', status);
  return new ApiError('invalid', `APIが検索条件を受理しませんでした（HTTP ${status}）。`, status);
}

function shouldRetry(error: ApiError): boolean {
  return (
    error.kind === 'network' ||
    error.kind === 'timeout' ||
    error.kind === 'rate-limit' ||
    error.kind === 'server'
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestJson<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  let lastError: ApiError | undefined;
  const nativeTransport = isTauri();
  const request = nativeTransport ? tauriFetch : globalThis.fetch;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await request(`${API_BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...createAppHeaders(nativeTransport),
          ...init?.headers,
        },
      });
      if (!response.ok) throw errorForStatus(response.status);
      const value: unknown = await response.json();
      return schema.parse(value);
    } catch (error: unknown) {
      if (controller.signal.aborted)
        lastError = new ApiError('timeout', 'APIが時間内に応答しませんでした。');
      else if (error instanceof ApiError) lastError = error;
      else if (error instanceof ZodError)
        lastError = new ApiError('invalid', 'APIの応答形式が変わったため、安全に表示できません。');
      else if (error instanceof SyntaxError)
        lastError = new ApiError('invalid', 'APIから読み取れるデータが返されませんでした。');
      else lastError = new ApiError('network', 'ネットワークに接続できませんでした。');
    } finally {
      window.clearTimeout(timeout);
    }

    const delay = RETRY_DELAYS_MS[attempt];
    if (!lastError || !shouldRetry(lastError) || delay === undefined) break;
    await wait(delay);
  }

  throw lastError ?? new ApiError('network', '不明な通信エラーが発生しました。');
}

export function getCollection(page: number, sort: CollectionSort, size = 24): Promise<Manga[]> {
  const params = new URLSearchParams({ page: String(page), size: String(size), desc: sort });
  return requestJson(`/manga/collection?${params.toString()}`, mangaListSchema);
}

function requestMangaSearch(request: MangaServerSearchRequest): Promise<Manga[]> {
  return requestJson('/search/query', mangaListSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

export function createServerSearchRequests(
  request: MangaSearchRequest,
): MangaServerSearchRequest[] {
  const { query, genres, ...rest } = request;
  const serverRequest: MangaServerSearchRequest = {
    ...rest,
    genres: genres.map((name) => ({ name })),
  };
  const keyword = query.trim();
  if (!keyword || serverRequest.name || serverRequest.authors) return [serverRequest];
  return [
    { ...serverRequest, name: keyword },
    { ...serverRequest, authors: keyword },
  ];
}

export async function searchManga(request: MangaSearchRequest): Promise<Manga[]> {
  const results = await Promise.all(
    createServerSearchRequests(request).map((serverRequest) => requestMangaSearch(serverRequest)),
  );
  const unique = new Map<number, Manga>();
  for (const manga of results.flat()) unique.set(manga.id, manga);
  return [...unique.values()];
}

export function getManga(id: number): Promise<Manga> {
  return requestJson(`/manga/${encodeURIComponent(id)}`, mangaSchema);
}

export async function getChapters(id: number): Promise<Chapter[]> {
  const chapters = await requestJson(`/chapter/${encodeURIComponent(id)}`, chapterListSchema);
  return chapters
    .filter((chapter) => chapter.content.length > 0)
    .sort((a, b) => a.chapter - b.chapter);
}

export function isBlockedImageDigest(digest: string): boolean {
  return BLOCKED_IMAGE_DIGESTS.has(digest.toLowerCase());
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function resolvePageImage(
  url: string,
  signal: AbortSignal,
): Promise<ResolvedPageImage> {
  if (isBlockedImageUrl(url)) return { blocked: true };

  if (!isTauri()) return { blocked: false, source: url, byteLength: 0 };

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  signal.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), PAGE_IMAGE_REQUEST_TIMEOUT_MS);

  try {
    const response = await tauriFetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'image/*',
        ...createAppHeaders(true),
        Referer: 'https://lovehug.net',
      },
    });
    if (!response.ok) {
      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;
      throw new PageImageError(
        `画像を取得できませんでした（HTTP ${response.status}）。`,
        retryable,
      );
    }

    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_PAGE_IMAGE_BYTES) {
      throw new PageImageError('画像サイズが上限を超えています。', false);
    }

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_PAGE_IMAGE_BYTES) {
      throw new PageImageError('画像サイズが上限を超えています。', false);
    }
    if (isBlockedImageDigest(await sha256Hex(bytes))) return { blocked: true };

    const mediaType = detectPageImageMediaType(
      bytes,
      response.headers.get('content-type')?.split(';', 1)[0],
    );
    if (!mediaType) throw new PageImageError('画像ではないデータが返されました。', false);

    const blob = new Blob([bytes], { type: mediaType });
    const objectUrl = URL.createObjectURL(blob);
    return {
      blocked: false,
      source: objectUrl,
      blob,
      byteLength: bytes.byteLength,
      revoke: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error: unknown) {
    if (signal.aborted || error instanceof PageImageError) throw error;
    if (controller.signal.aborted) {
      throw new PageImageError('画像の取得がタイムアウトしました。', true);
    }
    throw new PageImageError('画像を取得できませんでした。', true);
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort', abortFromCaller);
  }
}

export function detectPageImageMediaType(
  data: ArrayBuffer,
  header?: string | null,
): string | undefined {
  if (header?.startsWith('image/')) return header;

  const bytes = new Uint8Array(data, 0, Math.min(data.byteLength, 16));
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const signature = new TextDecoder('ascii').decode(bytes);
  if (signature.startsWith('GIF87a') || signature.startsWith('GIF89a')) return 'image/gif';
  if (signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP') return 'image/webp';
  if (signature.slice(4, 12) === 'ftypavif' || signature.slice(4, 12) === 'ftypavis') {
    return 'image/avif';
  }
  return undefined;
}
