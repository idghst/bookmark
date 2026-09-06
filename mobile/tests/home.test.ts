import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  focus: null as null | (() => void | (() => void)),
  loadConfig: vi.fn(), fetchSnapshot: vi.fn(), save: vi.fn(), updateBookmark: vi.fn(),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({}), useFocusEffect: (fn: typeof mocks.focus) => { mocks.focus = fn; } }));
vi.mock("expo-web-browser", () => ({}));
vi.mock("react-native", () => {
  const Component = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  const Pressable = ({ children, onPress, accessibilityLabel }: { children?: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) =>
    React.createElement("div", { role: "button", onClick: onPress, "aria-label": accessibilityLabel }, children);
  const List = ({ data = [], renderItem }: { data?: unknown[]; renderItem: (props: { item: unknown }) => React.ReactNode }) =>
    React.createElement("div", null, data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item }))));
  return {
    ActivityIndicator: Component, Alert: { alert: vi.fn() }, FlatList: List, Pressable,
    RefreshControl: Component, ScrollView: Component, SectionList: Component, Text: Component, TextInput: Component,
    View: Component, StyleSheet: { create: (value: unknown) => value }, useColorScheme: () => "light",
  };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children) }));
vi.mock("@/lib/config", () => ({ loadConfig: mocks.loadConfig }));
vi.mock("@/lib/api", () => ({ ApiError: Error, fetchSnapshot: mocks.fetchSnapshot, updateBookmark: mocks.updateBookmark }));
vi.mock("@/lib/snapshot-store", () => ({ loadSnapshotCache: async () => null, saveSnapshotCache: mocks.save }));
import HomeScreen from "../src/app/index";

const snapshot = { folders: [], sections: [], folderSections: [], bookmarks: [], savedAt: 1 };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("ignores an old response after disconnecting", async () => {
  let resolve!: (value: typeof snapshot) => void;
  mocks.loadConfig.mockResolvedValue({ url: "https://old.test", key: "old" });
  mocks.fetchSnapshot.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(React.createElement(HomeScreen));
  await act(async () => { mocks.focus!(); });
  mocks.loadConfig.mockResolvedValue(null);
  await act(async () => { mocks.focus!(); });
  const disconnected = document.body.textContent;
  await act(async () => { resolve(snapshot); });
  expect(document.body.textContent).toBe(disconnected);
  expect(mocks.save).not.toHaveBeenCalled();
});

it("clears the old snapshot when the new connection fails", async () => {
  mocks.loadConfig.mockResolvedValue({ url: "https://old.test", key: "old" });
  mocks.fetchSnapshot.mockResolvedValue(snapshot);
  render(React.createElement(HomeScreen));
  await act(async () => { mocks.focus!(); });
  mocks.loadConfig.mockResolvedValue({ url: "https://new.test", key: "new" });
  mocks.fetchSnapshot.mockRejectedValue(new Error("new server failed"));
  await act(async () => { mocks.focus!(); });
  expect(screen.getByText("new server failed")).toBeTruthy();
});

it("does not persist a response after navigating to connection settings", async () => {
  let resolve!: (value: typeof snapshot) => void;
  mocks.loadConfig.mockResolvedValue({ url: "https://old.test", key: "old" });
  mocks.fetchSnapshot.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(React.createElement(HomeScreen));
  let blur: void | (() => void);
  await act(async () => { blur = mocks.focus!(); });
  await act(async () => { if (blur) blur(); resolve(snapshot); });
  expect(mocks.save).not.toHaveBeenCalled();
});

it("rolls back a failed favorite after blur and an offline return to the same connection", async () => {
  const bookmark = { id: "one", title: "One", url: "https://one.test", isFavorite: false, folderId: null, folderSectionId: null, description: null, position: 0 };
  let reject!: (error: Error) => void;
  mocks.loadConfig.mockResolvedValue({ url: "https://old.test", key: "old" });
  mocks.fetchSnapshot.mockResolvedValue({ ...snapshot, bookmarks: [bookmark] });
  mocks.updateBookmark.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  render(React.createElement(HomeScreen));
  let blur: void | (() => void);
  await act(async () => { blur = mocks.focus!(); });
  fireEvent.click(screen.getByRole("button", { name: "즐겨찾기 추가" }));
  expect(screen.getByRole("button", { name: "즐겨찾기 해제" })).toBeTruthy();
  await act(async () => { if (blur) blur(); reject(new Error("offline")); });
  mocks.fetchSnapshot.mockRejectedValue(new Error("offline"));
  await act(async () => { mocks.focus!(); });
  expect(screen.getByRole("button", { name: "즐겨찾기 추가" })).toBeTruthy();
  expect(mocks.save.mock.lastCall?.[0].bookmarks[0].isFavorite).toBe(false);
});

it("ignores the previous connection's failed mutation after changing config", async () => {
  const bookmark = { id: "one", title: "One", url: "https://one.test", isFavorite: false, folderId: null, folderSectionId: null, description: null, position: 0 };
  let reject!: (error: Error) => void;
  mocks.loadConfig.mockResolvedValue({ url: "https://old.test", key: "old" });
  mocks.fetchSnapshot.mockResolvedValue({ ...snapshot, bookmarks: [bookmark] });
  mocks.updateBookmark.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
  render(React.createElement(HomeScreen));
  let blur: void | (() => void);
  await act(async () => { blur = mocks.focus!(); });
  fireEvent.click(screen.getByRole("button", { name: "즐겨찾기 추가" }));
  await act(async () => { if (blur) blur(); });
  mocks.loadConfig.mockResolvedValue({ url: "https://new.test", key: "new" });
  mocks.fetchSnapshot.mockResolvedValue({ ...snapshot, bookmarks: [{ ...bookmark, isFavorite: true }] });
  await act(async () => { mocks.focus!(); });
  await act(async () => { reject(new Error("old request failed")); });
  expect(screen.getByRole("button", { name: "즐겨찾기 해제" })).toBeTruthy();
  expect(mocks.save.mock.lastCall?.[0].bookmarks[0].isFavorite).toBe(true);
});
