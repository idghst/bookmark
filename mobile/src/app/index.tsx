import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_THEME } from "@/theme/tokens";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = APP_THEME[colorScheme === "dark" ? "dark" : "light"];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Text style={styles.markText}>B</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Bookmark</Text>
        <Text style={[styles.description, { color: colors.muted }]}>모바일 앱 기반이 준비되었습니다.</Text>
        <View style={[styles.status, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>Expo Router</Text>
          <Text style={[styles.statusText, { color: colors.muted }]}>다음 단계에서 인증된 API 경계와 북마크 기능을 연결합니다.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
  },
  description: {
    fontSize: 16,
  },
  status: {
    width: "100%",
    maxWidth: 420,
    marginTop: 16,
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
