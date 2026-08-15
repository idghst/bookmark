import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError, createBookmark, listFolders } from "@/lib/api";
import { loadConfig, type ApiConfig } from "@/lib/config";
import type { Folder } from "@/lib/types";
import { APP_THEME } from "@/theme/tokens";

function normalizeBookmarkUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function AddBookmarkScreen() {
  const colorScheme = useColorScheme();
  const colors = APP_THEME[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadConfig().then((loaded) => {
      setConfig(loaded);
      if (!loaded) return;
      listFolders(loaded)
        .then(setFolders)
        .catch(() => setFolders([]));
    });
  }, []);

  const save = async () => {
    if (!config) {
      setError("연결 설정을 먼저 완료하세요.");
      return;
    }
    const trimmedTitle = title.trim();
    const normalizedUrl = normalizeBookmarkUrl(url);
    if (!trimmedTitle) {
      setError("제목을 입력하세요.");
      return;
    }
    if (!normalizedUrl) {
      setError("URL이 올바르지 않습니다.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createBookmark(config, {
        title: trimmedTitle,
        url: normalizedUrl,
        description: null,
        isFavorite: false,
        folderId,
        sectionId: null,
      });
      router.back();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "북마크를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>북마크 추가</Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>제목</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="예: Expo 공식 문서"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>URL</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>폴더</Text>
            <View style={styles.chips}>
              <Pressable
                onPress={() => setFolderId(null)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: folderId === null ? colors.primary : colors.surface,
                    borderColor: folderId === null ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: folderId === null ? "#ffffff" : colors.text }]}>
                  미분류
                </Text>
              </Pressable>
              {folders.map((folder) => {
                const active = folderId === folder.id;
                return (
                  <Pressable
                    key={folder.id}
                    onPress={() => setFolderId(folder.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {folder.color ? <View style={[styles.chipDot, { backgroundColor: folder.color }]} /> : null}
                    <Text style={[styles.chipText, { color: active ? "#ffffff" : colors.text }]}>
                      {folder.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => void save()}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary, opacity: busy || pressed ? 0.7 : 1 },
            ]}
          >
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>저장</Text>}
          </Pressable>

          <Pressable onPress={() => router.back()} disabled={busy} hitSlop={8}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>닫기</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  error: {
    color: "#ef4444",
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
});
