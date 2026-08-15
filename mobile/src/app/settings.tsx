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

import { ApiError, listBookmarks } from "@/lib/api";
import { clearConfig, DEFAULT_API_URL, loadConfig, normalizeApiUrl, saveConfig } from "@/lib/config";
import { APP_THEME } from "@/theme/tokens";

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = APP_THEME[colorScheme === "dark" ? "dark" : "light"];
  const router = useRouter();

  const [url, setUrl] = useState(DEFAULT_API_URL);
  const [key, setKey] = useState("");
  const [hadConfig, setHadConfig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadConfig().then((config) => {
      if (!config) return;
      setUrl(config.url);
      setKey(config.key);
      setHadConfig(true);
    });
  }, []);

  const save = async () => {
    const normalizedUrl = normalizeApiUrl(url);
    const trimmedKey = key.trim();
    if (!normalizedUrl) {
      setError("API 주소가 올바르지 않습니다.");
      return;
    }
    if (!trimmedKey) {
      setError("개인 키를 입력하세요.");
      return;
    }

    setBusy(true);
    setError("");
    const candidate = { url: normalizedUrl, key: trimmedKey };
    try {
      await listBookmarks(candidate);
      await saveConfig(candidate);
      router.back();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "연결 확인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await clearConfig();
      router.back();
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
          <Text style={[styles.title, { color: colors.text }]}>연결 설정</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            북마크 API 주소와 개인 키를 기기에만 저장합니다. 키는 웹 로그인에 사용하는 값과 같습니다.
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>API 주소</Text>
            <TextInput
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={DEFAULT_API_URL}
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>개인 키</Text>
            <TextInput
              value={key}
              onChangeText={setKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="BOOKMARK_API_KEY"
              placeholderTextColor={colors.muted}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />
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
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>연결 확인 후 저장</Text>
            )}
          </Pressable>

          {hadConfig ? (
            <Pressable onPress={() => void disconnect()} disabled={busy} hitSlop={8}>
              <Text style={styles.disconnectText}>연결 해제</Text>
            </Pressable>
          ) : null}

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
  description: {
    fontSize: 14,
    lineHeight: 20,
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
  disconnectText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
});
