/**
 * Dev-only design-system preview screen.
 *
 * Exercises every primitive across both color schemes and all five HR
 * zones so we can eyeball regressions during refactors.
 *
 * Gated behind `__DEV__`: in production builds the screen renders an
 * empty View. The plan called this `_design-system.tsx`; Expo Router
 * excludes underscored files from routing, so we use the bare name
 * and check `__DEV__` at runtime instead.
 */

import { router } from "expo-router";
import { Fragment, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppHeader,
  Badge,
  Banner,
  Button,
  Card,
  ChartCard,
  Chip,
  Divider,
  EmptyState,
  HR_ZONE_KEYS,
  Icon,
  Inline,
  LauncherCard,
  ListRow,
  Sheet,
  Sparkline,
  Stack,
  Stat,
  StatusPill,
  SummaryRow,
  Switch,
  type ThemePref,
  ZoneBar,
  ZonePill,
  useTheme,
} from "@/lib/design-system";

const ZONE_LABEL: Record<(typeof HR_ZONE_KEYS)[number], string> = {
  z1: "Z1 · Recovery",
  z2: "Z2 · Endurance",
  z3: "Z3 · Tempo",
  z4: "Z4 · Threshold",
  z5: "Z5 · Max",
};

export default function DesignSystemScreen() {
  if (!__DEV__) {
    return <View />;
  }
  return <DesignSystemPreview />;
}

function DesignSystemPreview() {
  const { tokens, prefScheme, setPrefScheme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchValue, setSwitchValue] = useState(true);

  const fakeCadence = [16, 18, 19, 22, 26, 28, 30, 31, 30, 29, 27, 25, 24, 26];
  const fakeHr: (number | null)[] = [
    null,
    null,
    98,
    105,
    118,
    132,
    145,
    158,
    162,
    160,
    155,
    152,
    150,
    148,
  ];

  return (
    <View style={[styles.root, { backgroundColor: tokens.colors.surface }]}>
      <AppHeader
        title="Design System"
        onBack={() => router.back()}
        backLabel="Done"
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Section title="Theme">
          <Card>
            <Stack gap="sm">
              <Text style={{ color: tokens.colors.text }}>
                Active scheme override
              </Text>
              <Inline gap="xs">
                {(["auto", "light", "dark"] as ThemePref[]).map((opt) => (
                  <Chip
                    key={opt}
                    selected={prefScheme === opt}
                    onPress={() => setPrefScheme(opt)}
                  >
                    {opt}
                  </Chip>
                ))}
              </Inline>
            </Stack>
          </Card>
        </Section>

        <Section title="Buttons">
          <Stack gap="md">
            {(["accent", "danger", "neutral"] as const).map((tone) => (
              <Inline key={tone} gap="xs" wrap>
                <Button
                  title="Filled"
                  tone={tone}
                  variant="filled"
                  onPress={noop}
                />
                <Button
                  title="Tinted"
                  tone={tone}
                  variant="tinted"
                  onPress={noop}
                />
                <Button
                  title="Plain"
                  tone={tone}
                  variant="plain"
                  onPress={noop}
                />
              </Inline>
            ))}
            <Inline gap="xs">
              <Button title="With icon" icon="play.fill" onPress={noop} />
              <Button title="Loading" loading onPress={noop} />
              <Button title="Disabled" disabled onPress={noop} />
            </Inline>
            <Button title="Block size lg" size="lg" block onPress={noop} />
          </Stack>
        </Section>

        <Section title="HR zones">
          <Stack gap="sm">
            {HR_ZONE_KEYS.map((z) => (
              <Inline key={z} gap="xs" align="center">
                <ZonePill zone={z} />
                <ZonePill zone={z} filled />
                <Text style={{ color: tokens.colors.text }}>
                  {ZONE_LABEL[z]}
                </Text>
              </Inline>
            ))}
            <ZoneBar current="z3" labels />
            <ZoneBar current={null} />
          </Stack>
        </Section>

        <Section title="Stats">
          <Stack gap="sm">
            <Stat label="Cadence" value="28" emphasis="primary" />
            <Inline gap="md" wrap>
              <Stat label="Strokes" value="142" />
              <Stat label="Pace" value="2:08" />
              <Stat
                label="Heart"
                value="162"
                accent={tokens.hrZones.z4.text}
                trailing={<ZonePill zone="z4" />}
              />
            </Inline>
          </Stack>
        </Section>

        <Section title="Banners">
          <Stack gap="xs">
            <Banner tone="info">Info: simple text body banner.</Banner>
            <Banner tone="warning" action={{ label: "Go home", onPress: noop }}>
              Heads-up: connected to a phone sensor only.
            </Banner>
            <Banner tone="success" title="Saved!">
              Activity stored locally and ready to share.
            </Banner>
            <Banner tone="danger">Permission denied: enable Bluetooth.</Banner>
          </Stack>
        </Section>

        <Section title="Status & badges">
          <Inline gap="xs" wrap>
            <Badge tone="neutral">Default</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Synced</Badge>
            <Badge tone="warning">Slow</Badge>
            <Badge tone="danger">Error</Badge>
          </Inline>
          <Inline gap="xs" wrap>
            <StatusPill tone="success" icon="checkmark.circle.fill">
              Ready · WitMotion
            </StatusPill>
            <StatusPill tone="neutral">78 bpm</StatusPill>
            <StatusPill tone="warning" icon="exclamationmark.triangle.fill">
              Phone fallback
            </StatusPill>
          </Inline>
        </Section>

        <Section title="Launcher cards">
          <Stack gap="sm">
            <LauncherCard
              tone="accent"
              iconName="figure.indoor.rowing"
              title="Free row"
              subtitle="Open-ended training session"
              onPress={noop}
            />
            <LauncherCard
              tone="neutral"
              iconName="play.fill"
              title="Start a workout"
              subtitle="Pick from a saved plan"
              disabled
              onPress={noop}
            />
          </Stack>
        </Section>

        <Section title="Cards & divider">
          <Card accentBar accentBarColor={tokens.colors.success}>
            <Text style={{ color: tokens.colors.text }}>
              Card with accentBar
            </Text>
          </Card>
          <Card variant="surface">
            <Text style={{ color: tokens.colors.text }}>
              variant=&quot;surface&quot;
            </Text>
          </Card>
          <Card padding="none">
            <SummaryRow label="Distance" value="2,450 m" divider />
            <SummaryRow label="Duration" value="11:42" divider />
            <SummaryRow label="Avg cadence" value="26 spm" />
          </Card>
          <Divider />
        </Section>

        <Section title="Empty state">
          <EmptyState
            title="No activities yet"
            cta={{ label: "Start a free row", onPress: noop }}
          >
            Hit start to record your first session.
          </EmptyState>
        </Section>

        <Section title="Charts">
          <Stack gap="sm">
            <ChartCard
              title="Cadence"
              subtitle="strokes per minute"
              values={fakeCadence}
              metric="cadence"
            />
            <ChartCard
              title="Heart rate"
              subtitle="bpm"
              values={fakeHr}
              metric="heart"
            />
            <Card>
              <Sparkline values={fakeCadence} height={32} />
            </Card>
          </Stack>
        </Section>

        <Section title="ListRow">
          <Card padding="none">
            <ListRow
              icon="gearshape.fill"
              label="Settings"
              subtitle="App preferences"
              onPress={noop}
            />
            <Divider inset={48} />
            <ListRow
              label="Toggle"
              accessory={
                <Switch value={switchValue} onValueChange={setSwitchValue} />
              }
            />
            <Divider inset={48} />
            <ListRow
              icon="trash"
              label="Delete recording"
              destructive
              onPress={noop}
            />
          </Card>
        </Section>

        <Section title="Sheet">
          <Button
            title="Open sheet"
            variant="tinted"
            onPress={() => setSheetOpen(true)}
          />
          <Sheet
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Pick something"
          >
            <Stack gap="xs">
              <Button
                title="Option A"
                onPress={() => setSheetOpen(false)}
                block
              />
              <Button
                title="Option B"
                variant="tinted"
                onPress={() => setSheetOpen(false)}
                block
              />
              <Button
                title="Cancel"
                variant="plain"
                onPress={() => setSheetOpen(false)}
                block
              />
            </Stack>
          </Sheet>
        </Section>

        <Section title="Icons">
          <Inline gap="md" wrap>
            {(
              [
                "text",
                "textSecondary",
                "accent",
                "success",
                "warning",
                "danger",
              ] as const
            ).map((tone) => (
              <Inline key={tone} gap="xs" align="center">
                <Icon name="heart.fill" size={20} tone={tone} />
                <Text style={{ color: tokens.colors.text }}>{tone}</Text>
              </Inline>
            ))}
          </Inline>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <Fragment>
      <Text
        style={[styles.sectionHeader, { color: tokens.colors.textSecondary }]}
      >
        {title.toUpperCase()}
      </Text>
      <Stack gap="sm">{children}</Stack>
    </Fragment>
  );
}

function noop() {}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 16,
  },
});
