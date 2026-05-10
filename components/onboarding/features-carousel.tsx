import { Image } from "expo-image";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Button, useTheme } from "@/lib/design-system";

import {
  buildSlideImageUrl,
  FEATURES_SLIDES,
  type FeaturesSlideImage,
} from "./features-images";

type Props = {
  /** Called when the user dismisses (Skip on any slide, or Get started on the last). */
  onComplete: () => void;
};

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

/**
 * First-install features carousel: 3 paged slides with hero image, headline,
 * body copy, page indicator, and Skip / Next / Get started controls.
 *
 * Re-uses the FlatList paging pattern from `SensorPlacementModal` but takes
 * the full screen rather than a centered card. We don't show a "Don't show
 * again" checkbox — the user-confirmed product behavior is "first install
 * only", so dismissing in any way (Skip or Get started) marks the carousel
 * as seen via the orchestrator.
 */
export function FeaturesCarousel({ onComplete }: Props) {
  const { tokens } = useTheme();
  const { t } = useTranslation("onboarding");
  const { width: screenWidth } = useWindowDimensions();

  const listRef = useRef<FlatList<FeaturesSlideImage>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = FEATURES_SLIDES.length;
  const isLast = activeIndex === total - 1;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<FeaturesSlideImage>[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  // Fall back to a momentum-end handler when `onViewableItemsChanged` drops
  // out under fast swipes on Android (the threshold isn't always met). We
  // round the offset against the page width to recover the index.
  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / screenWidth);
      if (index !== activeIndex) {
        setActiveIndex(index);
      }
    },
    [activeIndex, screenWidth],
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    listRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
  }, [activeIndex, isLast, onComplete]);

  const renderItem = useCallback(
    ({ item }: { item: FeaturesSlideImage }) => (
      <SlideView slide={item} slideWidth={screenWidth} translationT={t} />
    ),
    [screenWidth, t],
  );

  // FlatList needs a stable layout function so `scrollToIndex` works even
  // when the user hasn't scrolled past the offscreen pages yet.
  const getItemLayout = useCallback(
    (_: ArrayLike<FeaturesSlideImage> | null | undefined, index: number) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [screenWidth],
  );

  const dotColors = useMemo(
    () => ({
      active: tokens.colors.accent,
      inactive: tokens.colors.borderStrong,
    }),
    [tokens.colors.accent, tokens.colors.borderStrong],
  );

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.root, { backgroundColor: tokens.colors.surface }]}
    >
      <View style={styles.skipRow}>
        {!isLast ? (
          <Pressable
            onPress={onComplete}
            hitSlop={12}
            accessibilityRole="button"
          >
            <ThemedText
              style={[styles.skipLabel, { color: tokens.colors.accent }]}
            >
              {t("features.skip")}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={FEATURES_SLIDES}
        renderItem={renderItem}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={getItemLayout}
        style={styles.list}
      />

      <View
        style={styles.pager}
        accessibilityRole="adjustable"
        accessibilityLabel={t("features.a11yPager", {
          current: activeIndex + 1,
          total,
        })}
      >
        {FEATURES_SLIDES.map((slide, i) => (
          <View
            key={slide.key}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === activeIndex ? dotColors.active : dotColors.inactive,
                width: i === activeIndex ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Button
          title={isLast ? t("features.getStarted") : t("features.next")}
          onPress={handleNext}
          variant="filled"
          tone="accent"
          size="lg"
          block
        />
        <ThemedText
          style={[styles.credit, { color: tokens.colors.textTertiary }]}
        >
          {t("features.credit")}
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

type SlideProps = {
  slide: FeaturesSlideImage;
  slideWidth: number;
  translationT: (key: string) => string;
};

function SlideView({ slide, slideWidth, translationT: t }: SlideProps) {
  const { tokens } = useTheme();
  const imageUrl = buildSlideImageUrl(slide, slideWidth);

  return (
    <View style={[styles.slide, { width: slideWidth }]}>
      <View
        style={[
          styles.imageWrap,
          { backgroundColor: tokens.colors.surfaceElevated },
        ]}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.copyBlock}>
        <ThemedText
          type="title"
          style={[styles.headline, { color: tokens.colors.text }]}
        >
          {t(`features.slides.${slide.key}.title`)}
        </ThemedText>
        <ThemedText
          style={[styles.body, { color: tokens.colors.textSecondary }]}
        >
          {t(`features.slides.${slide.key}.body`)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  skipRow: {
    minHeight: 32,
    paddingHorizontal: 20,
    paddingTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  skipLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 24,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 24,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  copyBlock: {
    paddingHorizontal: 4,
    gap: 12,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  pager: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  credit: {
    fontSize: 12,
    textAlign: "center",
  },
});
