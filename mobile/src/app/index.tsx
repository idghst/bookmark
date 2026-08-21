import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, fetchSnapshot, updateBookmark } from "@/lib/api";
import { loadConfig, type ApiConfig } from "@/lib/config";
import { applyPendingBookmarks, isCurrentMutation, mutationsDisabled } from "@/lib/snapshot";
import { loadSnapshotCache, saveSnapshotCache } from "@/lib/snapshot-store";
import type { BookmarkItem, BookmarkPatch, Folder, FolderSection, Section } from "@/lib/types";
import { APP_THEME } from "@/theme/tokens";

type Status = "loading" | "ready" | "error" | "unconfigured";
type Filter = "all" | "favorites" | string;
type Chip = { id: Filter; label: string; color?: string | null };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function errorMessageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "데이터를 불러오지 못했습니다.";
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = APP_THEME[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [folderSections, setFolderSections] = useState<FolderSection[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const configRef = useRef<ApiConfig | null>(null);
  const hasDataRef = useRef(false);
  const pendingRef = useRef(new Map<string, BookmarkPatch>());
  const pendingEpochRef = useRef(new Map<string, number>());
  const mutationEpochRef = useRef(0);
  const fetchGenRef = useRef(0);
  const refreshInFlightRef = useRef(0);

  const applySnapshot = useCallback(
    (next: {
      folders: Folder[];
      sections: Section[];
      folderSections: FolderSection[];
      bookmarks: BookmarkItem[];
    }) => {
      setFolders(next.folders);
      setSections(next.sections);
      setFolderSections(next.folderSections);
      setBookmarks(applyPendingBookmarks(next.bookmarks, pendingRef.current));
      hasDataRef.current = true;
    },
    [],
  );

  const load = useCallback(async (opts?: { userRefresh?: boolean }) => {
    const config = await loadConfig();
    configRef.current = config;
    if (!config) {
      hasDataRef.current = false;
      pendingRef.current.clear();
      setStatus("unconfigured");
      return;
    }

    if (!hasDataRef.current) {
      const cache = await loadSnapshotCache();
      if (cache) {
        applySnapshot(cache);
        setStatus("ready");
      } else {
        setStatus("loading");
      }
    }

    if (opts?.userRefresh) {
      refreshInFlightRef.current += 1;
      setRefreshing(true);
    }

    const gen = ++fetchGenRef.current;
    try {
      const remote = await fetchSnapshot(config);
      if (gen !== fetchGenRef.current) return;
      applySnapshot(remote);
      setStatus("ready");
    } catch (error) {
      if (gen !== fetchGenRef.current) return;
      if (!hasDataRef.current) {
        setErrorMessage(errorMessageOf(error));
        setStatus("error");
      }
    } finally {
      if (opts?.userRefresh) {
        refreshInFlightRef.current = Math.max(0, refreshInFlightRef.current - 1);
        if (refreshInFlightRef.current === 0) setRefreshing(false);
      }
    }
  }, [applySnapshot]);

  useEffect(() => {
    if (status !== "ready") return;
    void saveSnapshotCache({
      folders,
      sections,
      folderSections,
      bookmarks,
      savedAt: Date.now(),
    });
  }, [bookmarks, folderSections, folders, sections, status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    await load({ userRefresh: true });
  }, [load]);

  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const folderSectionById = useMemo(
    () => new Map(folderSections.map((section) => [section.id, section])),
    [folderSections],
  );

  const visibleBookmarks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookmarks.filter((bookmark) => {
      if (filter === "favorites" && !bookmark.isFavorite) return false;
      if (filter !== "all" && filter !== "favorites" && bookmark.folderId !== filter) return false;
      if (!query) return true;
      return (
        bookmark.title.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query) ||
        (bookmark.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [bookmarks, filter, search]);

  const folderBookmarkSections = useMemo(() => {
    if (filter === "all" || filter === "favorites") return null;
    const owned = folderSections
      .filter((section) => section.folderId === filter)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "ko"));
    const known = new Set(owned.map((section) => section.id));
    const byId = new Map<string | null, BookmarkItem[]>();
    for (const bookmark of visibleBookmarks) {
      const sectionId = bookmark.folderSectionId && known.has(bookmark.folderSectionId)
        ? bookmark.folderSectionId
        : null;
      byId.set(sectionId, [...(byId.get(sectionId) ?? []), bookmark]);
    }
    const unsectioned = byId.get(null) ?? [];
    return [
      ...owned.map((section) => ({ title: section.name, data: byId.get(section.id) ?? [] })),
      ...(unsectioned.length ? [{ title: "섹션 없음", data: unsectioned }] : []),
    ];
  }, [filter, folderSections, visibleBookmarks]);

  const openBookmark = useCallback(async (bookmark: BookmarkItem) => {
    try {
      await WebBrowser.openBrowserAsync(bookmark.url);
    } catch {
      Alert.alert("링크 열기 실패", bookmark.url);
    }
  }, []);

  const toggleFavorite = useCallback((bookmark: BookmarkItem) => {
    const config = configRef.current;
    if (!config || mutationsDisabled(hasDataRef.current)) return;
    const nextValue = !bookmark.isFavorite;
    const epoch = ++mutationEpochRef.current;
    pendingRef.current.set(bookmark.id, { isFavorite: nextValue });
    pendingEpochRef.current.set(bookmark.id, epoch);
    setBookmarks((prev) =>
      prev.map((item) => (item.id === bookmark.id ? { ...item, isFavorite: nextValue } : item)),
    );
    updateBookmark(config, bookmark.id, { isFavorite: nextValue })
      .then(() => {
        if (!isCurrentMutation(pendingEpochRef.current.get(bookmark.id), epoch)) return;
        pendingRef.current.delete(bookmark.id);
        pendingEpochRef.current.delete(bookmark.id);
      })
      .catch((error: unknown) => {
        if (!isCurrentMutation(pendingEpochRef.current.get(bookmark.id), epoch)) return;
        pendingRef.current.delete(bookmark.id);
        pendingEpochRef.current.delete(bookmark.id);
        setBookmarks((prev) =>
          prev.map((item) =>
            item.id === bookmark.id ? { ...item, isFavorite: bookmark.isFavorite } : item,
          ),
        );
        Alert.alert("즐겨찾기 변경 실패", errorMessageOf(error));
      });
  }, []);

  const renderBookmark = useCallback(
    ({ item }: { item: BookmarkItem }) => {
      const folder = item.folderId ? folderById.get(item.folderId) : undefined;
      const folderSection = item.folderSectionId ? folderSectionById.get(item.folderSectionId) : undefined;
      const accent = folder?.color ?? colors.primary;
      const subtitle = [hostOf(item.url), item.description ?? ""].filter(Boolean).join(" · ");
      return (
        <Pressable
          onPress={() => void openBookmark(item)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.rowMark, { backgroundColor: accent }]}>
            <Text style={styles.rowMarkText}>{item.title.trim().charAt(0).toUpperCase() || "B"}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            <Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.muted }]}>
              {subtitle}
            </Text>
            {folder ? (
              <Text numberOfLines={1} style={[styles.rowFolder, { color: colors.muted }]}>
                {folderSection ? `${folder.name} · ${folderSection.name}` : `${folder.name} · 섹션 없음`}
              </Text>
            ) : null}
          </View>
          <Pressable
            hitSlop={12}
            onPress={() => toggleFavorite(item)}
            style={styles.starButton}
            accessibilityLabel={item.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          >
            <Text style={[styles.star, { color: item.isFavorite ? "#f59e0b" : colors.border }]}>
              {item.isFavorite ? "★" : "☆"}
            </Text>
          </Pressable>
        </Pressable>
      );
    },
    [colors, folderById, folderSectionById, openBookmark, toggleFavorite],
  );

  const pinnedChips: Chip[] = [
    { id: "all", label: "전체" },
    { id: "favorites", label: "★ 즐겨찾기" },
  ];

  const folderGroups = useMemo(() => {
    const sectionIds = new Set(sections.map((section) => section.id));
    const bySection = new Map<string, Folder[]>();
    const unsectioned: Folder[] = [];
    for (const folder of folders) {
      const sectionId = folder.sectionId;
      if (sectionId && sectionIds.has(sectionId)) {
        const list = bySection.get(sectionId) ?? [];
        list.push(folder);
        bySection.set(sectionId, list);
      } else {
        unsectioned.push(folder);
      }
    }
    for (const list of bySection.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    unsectioned.sort((a, b) => a.position - b.position);
    return {
      sections: [...sections].sort((a, b) => a.position - b.position),
      bySection,
      unsectioned,
    };
  }, [folders, sections]);

  const folderToChip = (folder: Folder): Chip => ({
    id: folder.id,
    label: folder.name,
    color: folder.color,
  });

  const renderChip = (chip: Chip) => {
    const active = filter === chip.id;
    return (
      <Pressable
        key={chip.id}
        onPress={() => setFilter(chip.id)}
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.primary : colors.surface,
            borderColor: active ? colors.primary : colors.border,
          },
        ]}
      >
        {chip.color ? <View style={[styles.chipDot, { backgroundColor: chip.color }]} /> : null}
        <Text style={[styles.chipText, { color: active ? "#ffffff" : colors.text }]}>{chip.label}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.title, { color: colors.text }]}>Bookmark</Text>
          {status === "ready" ? (
            <Text style={[styles.count, { color: colors.muted }]}>{visibleBookmarks.length}개</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push("/settings")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.settingsButton,
            { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.settingsButtonText, { color: colors.muted }]}>설정</Text>
        </Pressable>
      </View>

      {status === "loading" ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {status === "unconfigured" ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>연결 설정이 필요합니다</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            API 주소와 개인 키를 입력하면 북마크를 불러옵니다.
          </Text>
          <Pressable
            onPress={() => router.push("/settings")}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.primaryButtonText}>연결 설정</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "error" ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>불러오지 못했습니다</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>{errorMessage}</Text>
          <Pressable onPress={() => void load()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      {status === "ready" ? (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="제목, 주소, 설명 검색"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.search,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />
          {sections.length === 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {[...pinnedChips, ...folders.map(folderToChip)].map(renderChip)}
            </ScrollView>
          ) : (
            <ScrollView style={styles.chipGroupsScroll} contentContainerStyle={styles.chipGroups}>
              <View style={styles.chipsWrap}>{pinnedChips.map(renderChip)}</View>
              {folderGroups.sections.map((section) => {
                const sectionFolders = folderGroups.bySection.get(section.id);
                if (!sectionFolders?.length) return null;
                return (
                  <View key={section.id} style={styles.chipGroup}>
                    <Text style={[styles.sectionLabel, { color: colors.muted }]}>{section.name}</Text>
                    <View style={styles.chipsWrap}>{sectionFolders.map((folder) => renderChip(folderToChip(folder)))}</View>
                  </View>
                );
              })}
              {folderGroups.unsectioned.length > 0 ? (
                <View style={styles.chipGroup}>
                  <Text style={[styles.sectionLabel, { color: colors.muted }]}>섹션 없음</Text>
                  <View style={styles.chipsWrap}>
                    {folderGroups.unsectioned.map((folder) => renderChip(folderToChip(folder)))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          )}
          {folderBookmarkSections ? (
            <SectionList
              sections={folderBookmarkSections}
              keyExtractor={(item) => item.id}
              renderItem={renderBookmark}
              renderSectionHeader={({ section }) => (
                <Text style={[styles.bookmarkSectionHeader, { color: colors.muted }]}>{section.title}</Text>
              )}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.muted} />
              }
              ListEmptyComponent={
                <View style={styles.listEmpty}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {search.trim() || filter !== "all" ? "조건에 맞는 북마크가 없습니다." : "북마크가 없습니다."}
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={visibleBookmarks}
              keyExtractor={(item) => item.id}
              renderItem={renderBookmark}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.muted} />
              }
              ListEmptyComponent={
                <View style={styles.listEmpty}>
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {search.trim() || filter !== "all" ? "조건에 맞는 북마크가 없습니다." : "북마크가 없습니다."}
                  </Text>
                </View>
              }
            />
          )}
          <Pressable
            onPress={() => router.push("/add")}
            accessibilityLabel="북마크 추가"
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.fabText}>＋</Text>
          </Pressable>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  count: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingsButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  search: {
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  chips: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chipGroupsScroll: {
    flexGrow: 0,
    maxHeight: 180,
  },
  chipGroups: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  chipGroup: {
    gap: 6,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  bookmarkSectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    paddingTop: 12,
    paddingBottom: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 96,
    gap: 8,
  },
  listEmpty: {
    paddingTop: 48,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  rowMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMarkText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    fontSize: 13,
  },
  rowFolder: {
    fontSize: 12,
  },
  starButton: {
    paddingHorizontal: 4,
  },
  star: {
    fontSize: 22,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  fabText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 30,
  },
});
