export async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (payload.detail === "Database request failed") {
      return "데이터베이스 요청에 실패했습니다. 잠시 후 다시 시도하세요.";
    }
    if (typeof payload.detail === "string") return payload.detail;
  } catch {
    // Fall back to status text below.
  }
  return response.statusText || "API 요청에 실패했습니다.";
}
