import * as SecureStore from "expo-secure-store";

export const DEFAULT_API_URL = "https://api-bookmark.idghst.co.kr";

const URL_STORE_KEY = "bookmark.api.url";
const KEY_STORE_KEY = "bookmark.api.key";

export type ApiConfig = {
  url: string;
  key: string;
};

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
  const [url, key] = await Promise.all([
    SecureStore.getItemAsync(URL_STORE_KEY),
    SecureStore.getItemAsync(KEY_STORE_KEY),
  ]);
  if (!url || !key) return null;
  return { url, key };
}

export async function saveConfig(config: ApiConfig): Promise<void> {
  await SecureStore.setItemAsync(URL_STORE_KEY, config.url);
  await SecureStore.setItemAsync(KEY_STORE_KEY, config.key);
}

export async function clearConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(URL_STORE_KEY);
  await SecureStore.deleteItemAsync(KEY_STORE_KEY);
}
