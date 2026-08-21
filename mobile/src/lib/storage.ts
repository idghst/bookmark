import * as SecureStore from "expo-secure-store";

export async function storageGet(key: string): Promise<string | null> {
  if (await SecureStore.isAvailableAsync()) {
    return SecureStore.getItemAsync(key);
  }
  return globalThis.localStorage?.getItem(key) ?? null;
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  globalThis.localStorage?.setItem(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  globalThis.localStorage?.removeItem(key);
}