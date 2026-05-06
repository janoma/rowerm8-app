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

import arBle from "@/locales/ar/ble.json";
import arCommon from "@/locales/ar/common.json";
import arHome from "@/locales/ar/home.json";
import arModal from "@/locales/ar/modal.json";
import arRow from "@/locales/ar/row.json";
import arSensor from "@/locales/ar/sensor.json";
import arSettings from "@/locales/ar/settings.json";
import arTabs from "@/locales/ar/tabs.json";
import deBle from "@/locales/de/ble.json";
import deCommon from "@/locales/de/common.json";
import deHome from "@/locales/de/home.json";
import deModal from "@/locales/de/modal.json";
import deRow from "@/locales/de/row.json";
import deSensor from "@/locales/de/sensor.json";
import deSettings from "@/locales/de/settings.json";
import deTabs from "@/locales/de/tabs.json";
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
import frBle from "@/locales/fr/ble.json";
import frCommon from "@/locales/fr/common.json";
import frHome from "@/locales/fr/home.json";
import frModal from "@/locales/fr/modal.json";
import frRow from "@/locales/fr/row.json";
import frSensor from "@/locales/fr/sensor.json";
import frSettings from "@/locales/fr/settings.json";
import frTabs from "@/locales/fr/tabs.json";
import itBle from "@/locales/it/ble.json";
import itCommon from "@/locales/it/common.json";
import itHome from "@/locales/it/home.json";
import itModal from "@/locales/it/modal.json";
import itRow from "@/locales/it/row.json";
import itSensor from "@/locales/it/sensor.json";
import itSettings from "@/locales/it/settings.json";
import itTabs from "@/locales/it/tabs.json";
import jaBle from "@/locales/ja/ble.json";
import jaCommon from "@/locales/ja/common.json";
import jaHome from "@/locales/ja/home.json";
import jaModal from "@/locales/ja/modal.json";
import jaRow from "@/locales/ja/row.json";
import jaSensor from "@/locales/ja/sensor.json";
import jaSettings from "@/locales/ja/settings.json";
import jaTabs from "@/locales/ja/tabs.json";
import zhHansBle from "@/locales/zh-Hans/ble.json";
import zhHansCommon from "@/locales/zh-Hans/common.json";
import zhHansHome from "@/locales/zh-Hans/home.json";
import zhHansModal from "@/locales/zh-Hans/modal.json";
import zhHansRow from "@/locales/zh-Hans/row.json";
import zhHansSensor from "@/locales/zh-Hans/sensor.json";
import zhHansSettings from "@/locales/zh-Hans/settings.json";
import zhHansTabs from "@/locales/zh-Hans/tabs.json";

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
  fr: {
    common: frCommon,
    tabs: frTabs,
    home: frHome,
    row: frRow,
    sensor: frSensor,
    ble: frBle,
    settings: frSettings,
    modal: frModal,
  },
  it: {
    common: itCommon,
    tabs: itTabs,
    home: itHome,
    row: itRow,
    sensor: itSensor,
    ble: itBle,
    settings: itSettings,
    modal: itModal,
  },
  ja: {
    common: jaCommon,
    tabs: jaTabs,
    home: jaHome,
    row: jaRow,
    sensor: jaSensor,
    ble: jaBle,
    settings: jaSettings,
    modal: jaModal,
  },
  ar: {
    common: arCommon,
    tabs: arTabs,
    home: arHome,
    row: arRow,
    sensor: arSensor,
    ble: arBle,
    settings: arSettings,
    modal: arModal,
  },
  de: {
    common: deCommon,
    tabs: deTabs,
    home: deHome,
    row: deRow,
    sensor: deSensor,
    ble: deBle,
    settings: deSettings,
    modal: deModal,
  },
  // BCP-47 tag with script subtag — must be quoted because it's not a
  // valid JS identifier. i18next looks up languages by exact tag, so this
  // matches `SupportedLanguageCode` ("zh-Hans") and the OS-resolved language.
  "zh-Hans": {
    common: zhHansCommon,
    tabs: zhHansTabs,
    home: zhHansHome,
    row: zhHansRow,
    sensor: zhHansSensor,
    ble: zhHansBle,
    settings: zhHansSettings,
    modal: zhHansModal,
  },
} as const;
