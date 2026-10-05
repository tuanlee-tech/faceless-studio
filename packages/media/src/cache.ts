import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";

/** Thư mục cache mặc định trong project. */
export const CACHE_DIR = ".cache";

/**
 * Tạo SHA-256 hex từ chuỗi hoặc buffer.
 */
export function hashInput(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Tạo hash từ nhiều phần (dùng cho cache key kết hợp).
 */
export function hashParts(...parts: Array<string | Uint8Array>): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}

/**
 * Đọc file cache nếu tồn tại và khớp hash.
 * Trả về nội dung parse JSON hoặc null nếu miss/invalid.
 */
export async function readCache<T>(cacheDir: string, key: string): Promise<T | null> {
  const filePath = join(cacheDir, `${key}.json`);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const { hash, data, savedAt } = JSON.parse(content);
    if (hash === key) return data as T;
  } catch {
    // miss hoặc corrupt → null
  }
  return null;
}

/**
 * Ghi file cache với hash key.
 */
export async function writeCache<T>(cacheDir: string, key: string, data: T): Promise<void> {
  const filePath = join(cacheDir, `${key}.json`);
  await fs.mkdir(cacheDir, { recursive: true });
  const payload = JSON.stringify({ hash: key, data, savedAt: new Date().toISOString() });
  await fs.writeFile(filePath, payload, "utf-8");
}

/**
 * Xóa file cache (dùng khi invalidate).
 */
export async function deleteCache(cacheDir: string, key: string): Promise<void> {
  const filePath = join(cacheDir, `${key}.json`);
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

/**
 * Đảm bảo thư mục cache tồn tại.
 */
export async function ensureCacheDir(cacheDir: string): Promise<void> {
  await fs.mkdir(cacheDir, { recursive: true });
}