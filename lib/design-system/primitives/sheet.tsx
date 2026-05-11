/**
 * Sheet — bottom-sheet-style modal (iOS / web flavor).
 *
 * A thin generalisation of the existing `SensorPickerSheet` modal:
 * dimmed backdrop + slide-up surface with a grabber, optional title,
 * and a content slot. The Android sibling renders the same shape with
 * MD3 spec elevation and a slightly different grabber.
 *
 * For iOS-native presentation styles like `formSheet`, configure the
 * navigator instead — this primitive is for in-place modal sheets
 * triggered by buttons inside a screen.
 */

import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../provider";
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoider}
          pointerEvents="box-none"
        >
          <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: tokens.colors.surface,
                  borderTopLeftRadius: tokens.radius.xl,
                  borderTopRightRadius: tokens.radius.xl,
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardAvoider: {
    width: "100%",
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
    width: 36,
    height: 5,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    gap: 8,
  },
});
