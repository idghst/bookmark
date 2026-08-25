"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string };
export type ToastHistoryItem = ToastItem & { createdAt: string };

// 컨텍스트 없이 어디서든 toast(...)를 호출할 수 있는 모듈 전역 스토어(pub/sub).
let listeners: Array<(items: ToastItem[]) => void> = [];
let historyListeners: Array<(items: ToastHistoryItem[]) => void> = [];
let items: ToastItem[] = [];
let historyItems: ToastHistoryItem[] = [];
let nextId = 1;
const emit = () => listeners.forEach((l) => l(items));
const emitHistory = () => historyListeners.forEach((l) => l(historyItems));
const HISTORY_STORAGE_KEY = "app-template-toast-history";
const MAX_HISTORY_ITEMS = 80;
let historyLoaded = false;

function loadStoredHistory() {
  if (historyLoaded || typeof window === "undefined") return;
  historyLoaded = true;

  try {
    const stored = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored) as ToastHistoryItem[];
    if (!Array.isArray(parsed)) return;
    historyItems = parsed
      .filter((item) => typeof item?.id === "number" && typeof item?.message === "string" && typeof item?.createdAt === "string")
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    historyItems = [];
  }
}

function saveStoredHistory() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // 저장 공간 제한은 런타임 알림 표시를 막지 않는다.
  }
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function pushToast(message: string, type: ToastType = "success", durationMs = 2400) {
  loadStoredHistory();
  const id = nextId++;
  const item = { id, type, message };
  items = [...items, item];
  historyItems = [{ ...item, createdAt: new Date().toISOString() }, ...historyItems].slice(0, MAX_HISTORY_ITEMS);
  emit();
  saveStoredHistory();
  emitHistory();
  if (durationMs > 0 && typeof window !== "undefined") {
    window.setTimeout(() => dismissToast(id), durationMs);
  }
  return id;
}

/** 놓치면 안 되는 결과와 오류만 우측 하단에 알린다. */
export const toast = Object.assign(pushToast, {
  success: (message: string, durationMs?: number) => pushToast(message, "success", durationMs),
  error: (message: string, durationMs?: number) => pushToast(message, "error", durationMs ?? 4200),
  info: (message: string, durationMs?: number) => pushToast(message, "info", durationMs)
});

export function subscribeToastHistory(listener: (items: ToastHistoryItem[]) => void) {
  loadStoredHistory();
  historyListeners.push(listener);
  listener(historyItems);

  return () => {
    historyListeners = historyListeners.filter((l) => l !== listener);
  };
}

export function clearToastHistory() {
  loadStoredHistory();
  historyItems = [];
  saveStoredHistory();
  emitHistory();
}

const STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: typeof CheckCircle2; iconColor: string }> = {
  success: { bg: "#181715", border: "#252320", text: "#faf9f5", icon: CheckCircle2, iconColor: "#5db872" },
  error: { bg: "#181715", border: "#252320", text: "#faf9f5", icon: AlertCircle, iconColor: "#c64545" },
  info: { bg: "#181715", border: "#252320", text: "#faf9f5", icon: Info, iconColor: "#cc785c" }
};

function ToastCard({ item }: { item: ToastItem }) {
  const s = STYLES[item.type];
  const Icon = s.icon;
  return (
    <div
      role="status"
      className="pop-in pointer-events-auto flex w-full items-center gap-2 rounded-lg px-3 py-2.5 shadow-lg"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: s.iconColor }} />
      <p className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: s.text }}>
        {item.message}
      </p>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="알림 닫기"
        className="shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100"
        style={{ color: s.text }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// 우측 하단 토스트 뷰포트. 루트 레이아웃에 한 번 마운트한다.
export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.push(setList);
    setList(items);
    return () => {
      listeners = listeners.filter((l) => l !== setList);
    };
  }, []);
  if (!list.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[100] w-[min(280px,calc(100vw-24px))] space-y-2">
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
