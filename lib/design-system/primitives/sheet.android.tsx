/**
 * Sheet — Material Design 3 modal bottom-sheet flavor.
 *
 * Differs from the iOS / web implementation in:
 *   - taller grabber with the canonical MD3 dimensions (32 × 4)
 *   - tighter top corners (16 dp vs 24 dp)
 *   - native Android elevation underlay so the sheet casts a shadow
 *     against the dimmed scrim.
 */

import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../provider";
import { elevationStyle } from "../tokens/elevation";
import { type SheetProps } from "./sheet.shared";

export function Sheet({
  visible,
  onClose,
  children,
  title,
  dismissOnBackdrop = true,
}: SheetProps) {
  const { tokens } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[styles.backdrop, { backgroundColor: tokens.colors.overlay }]}
      >
        {dismissOnBackdrop ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        ) : null}
        <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
          <View
            style={[
              styles.sheet,
              elevationStyle("level3"),
              {
                backgroundColor: tokens.colors.surfaceElevated,
                borderTopLeftRadius: tokens.radius.lg,
                borderTopRightRadius: tokens.radius.lg,
              },
            ]}
          >
            <View
              style={[
                styles.grabber,
                { backgroundColor: tokens.colors.borderStrong },
              ]}
            />
            {title ? (
              <Text style={[styles.title, { color: tokens.colors.text }]}>
                {title}
              </Text>
            ) : null}
            <View style={styles.body}>{children}</View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  safeArea: {
    width: "100%",
  },
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  grabber: {
    width: 32,
    height: 4,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "left",
    paddingHorizontal: 8,
  },
  body: {
    gap: 8,
  },
});
