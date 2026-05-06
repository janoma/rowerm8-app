/**
 * Static catalog registry. Each language is keyed by namespace.
 *
 * Translations are JSON files committed under `locales/<lang>/<ns>.json`.
 * Importing them statically lets Metro tree-shake unused ones at build time
 * and removes any need for filesystem access at runtime (which we don't have
 * on iOS without `expo-asset`).
 *
 * Adding a new locale: drop matching JSON files into `locales/<lang>/`,
 * import them below, and register them under `RESOURCES[<lang>]`.
 */

import enBle from "@/locales/en/ble.json";
import enCommon from "@/locales/en/common.json";
import enHome from "@/locales/en/home.json";
import enModal from "@/locales/en/modal.json";
import enRow from "@/locales/en/row.json";
import enSensor from "@/locales/en/sensor.json";
import enSettings from "@/locales/en/settings.json";
import enTabs from "@/locales/en/tabs.json";
import esBle from "@/locales/es/ble.json";
import esCommon from "@/locales/es/common.json";
import esHome from "@/locales/es/home.json";
import esModal from "@/locales/es/modal.json";
import esRow from "@/locales/es/row.json";
import esSensor from "@/locales/es/sensor.json";
import esSettings from "@/locales/es/settings.json";
import esTabs from "@/locales/es/tabs.json";

export const NAMESPACES = [
  "common",
  "tabs",
  "home",
  "row",
  "sensor",
  "ble",
  "settings",
  "modal",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";

export const RESOURCES = {
  en: {
    common: enCommon,
    tabs: enTabs,
    home: enHome,
    row: enRow,
    sensor: enSensor,
    ble: enBle,
    settings: enSettings,
    modal: enModal,
  },
  es: {
    common: esCommon,
    tabs: esTabs,
    home: esHome,
    row: esRow,
    sensor: esSensor,
    ble: esBle,
    settings: esSettings,
    modal: esModal,
  },
} as const;
