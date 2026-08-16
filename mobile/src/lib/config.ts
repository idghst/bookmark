import * as SecureStore from "expo-secure-store";

export const DEFAULT_API_URL = "https://api-bookmark.idghst.co.kr";

const URL_STORE_KEY = "bookmark.api.url";
const KEY_STORE_KEY = "bookmark.api.key";

export type ApiConfig = {
  url: string;
  key: string;
};

async function storageGet(key: string): Promise<string | null> {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(key);
  }
  return globalThis.localStorage?.getItem(key) ?? null;
}

async function storageSet(key: string, value: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  globalThis.localStorage?.setItem(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  globalThis.localStorage?.removeItem(key);
}

/** http(s) origin만 허용하고 뒤쪽 슬래시를 제거합니다. 잘못된 입력이면 null. */
export function normalizeApiUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return null;
  }
}

export async function loadConfig(): Promise<ApiConfig | null> {
  try {
    const [url, key] = await Promise.all([
      storageGet(URL_STORE_KEY),
      storageGet(KEY_STORE_KEY),
    ]);
    if (!url || !key) return null;
    return { url, key };
  } catch {
    return null;
  }
}

export async function saveConfig(config: ApiConfig): Promise<void> {
  await storageSet(URL_STORE_KEY, config.url);
  await storageSet(KEY_STORE_KEY, config.key);
}

export async function clearConfig(): Promise<void> {
  await storageDelete(URL_STORE_KEY);
  await storageDelete(KEY_STORE_KEY);
}
