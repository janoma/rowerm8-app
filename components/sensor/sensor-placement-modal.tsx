import { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewToken,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    backdrop: "rgba(0, 0, 0, 0.35)",
    card: "#FFFFFF",
    title: "#11181C",
    body: "#687076",
    dot: "#D1D5DA",
    dotActive: "#0a7ea4",
    checkIcon: "#687076",
    checkLabel: "#687076",
    primaryBg: "#0a7ea4",
    primaryText: "#FFFFFF",
    imageBg: "#F6F7F8",
  },
  dark: {
    backdrop: "rgba(0, 0, 0, 0.55)",
    card: "#1B1D1F",
    title: "#ECEDEE",
    body: "#9BA1A6",
    dot: "#3A3D40",
    dotActive: "#3DB7E0",
    checkIcon: "#9BA1A6",
    checkLabel: "#9BA1A6",
    primaryBg: "#0a7ea4",
    primaryText: "#FFFFFF",
    imageBg: "#26292C",
  },
} as const;

type Slide = {
  key: string;
  image: ImageSourcePropType;
  text: string;
};

const SLIDE_HANDLEBAR: Slide = {
  key: "handlebar",
  image: require("@/assets/images/sensor-placement-1.png"),
  text: "Attach the sensor to the side of the handlebar using double-sided tape or velcro.",
};

const SLIDE_PHONE: Slide = {
  key: "phone",
  image: require("@/assets/images/sensor-placement-3.png"),
  text: "If you\u2019re using your phone instead, attach it to the side of the seat \u2014 you\u2019re less likely to bump it there.",
};

type Props = {
  visible: boolean;
  onDismiss: (dontShowAgain: boolean) => void;
  source: "phone" | "ble";
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_H_PADDING = 24;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 400);
const IMAGE_WIDTH = CARD_WIDTH - CARD_H_PADDING * 2;

export function SensorPlacementModal({ visible, onDismiss, source }: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];

  const slides = useMemo<Slide[]>(
    () =>
      source === "phone" ? [SLIDE_HANDLEBAR, SLIDE_PHONE] : [SLIDE_HANDLEBAR],
    [source],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const flatListRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Slide>[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const handleDismiss = useCallback(() => {
    onDismiss(dontShow);
    setActiveIndex(0);
    setDontShow(false);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [dontShow, onDismiss]);

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={[styles.slideContainer, { width: IMAGE_WIDTH }]}>
        <Image
          source={item.image}
          style={[styles.slideImage, { backgroundColor: palette.imageBg }]}
          resizeMode="contain"
        />
      </View>
    ),
    [palette.imageBg],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { backgroundColor: palette.backdrop }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.card, width: CARD_WIDTH },
          ]}
        >
          <FlatList
            ref={flatListRef}
            data={slides}
            renderItem={renderItem}
            keyExtractor={(s) => s.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig.current}
            getItemLayout={(_, index) => ({
              length: IMAGE_WIDTH,
              offset: IMAGE_WIDTH * index,
              index,
            })}
            style={styles.carousel}
          />

          {slides.length > 1 ? (
            <View style={styles.dots}>
              {slides.map((s, i) => (
                <View
                  key={s.key}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === activeIndex ? palette.dotActive : palette.dot,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}

          <ThemedText style={[styles.body, { color: palette.body }]}>
            {slides[activeIndex]?.text}
          </ThemedText>

          <Pressable
            onPress={() => setDontShow((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dontShow }}
            style={styles.checkRow}
            hitSlop={6}
          >
            <IconSymbol
              name={dontShow ? "checkmark.square.fill" : "square"}
              size={22}
              color={dontShow ? palette.dotActive : palette.checkIcon}
            />
            <ThemedText
              style={[styles.checkLabel, { color: palette.checkLabel }]}
            >
              Don&apos;t show this again
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleDismiss}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: palette.primaryBg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <ThemedText
              style={[styles.primaryButtonText, { color: palette.primaryText }]}
            >
              Got it
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: CARD_H_PADDING,
    gap: 14,
    alignItems: "center",
  },
  carousel: {
    flexGrow: 0,
  },
  slideContainer: {
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  slideImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  checkLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  primaryButton: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
});
