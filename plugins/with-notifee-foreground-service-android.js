/**
 * Expo config plugin: configure the Notifee Android foreground service.
 *
 * Notifee 9.x bundles its own `<service>` declaration inside its AAR
 * (`app.notifee.core.ForegroundService`). On Android 14+ a foreground
 * service started with `FOREGROUND_SERVICE_TYPE_HEALTH` must also have
 * its manifest entry declare `android:foregroundServiceType="health"`.
 *
 * Without this plugin the merged manifest inherits whatever default the
 * AAR ships, which doesn't always include "health". We force-merge a
 * `health` foregroundServiceType onto the Notifee service entry, which
 * is what runtime call to `notifee.displayNotification({ android: {
 * asForegroundService: true, foregroundServiceTypes:
 * [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_HEALTH] } })`
 * needs in order for `startForeground(id, n, HEALTH)` to be allowed.
 *
 * No-op on iOS.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

const NOTIFEE_SERVICE_NAME = "app.notifee.core.ForegroundService";
const REQUIRED_TYPE = "health";

function withNotifeeForegroundService(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      return cfg;
    }
    application.service = application.service ?? [];

    cfg.modResults.manifest.$ = cfg.modResults.manifest.$ ?? {};
    cfg.modResults.manifest.$["xmlns:tools"] =
      cfg.modResults.manifest.$["xmlns:tools"] ??
      "http://schemas.android.com/tools";

    const existing = application.service.find(
      (s) => s.$ && s.$["android:name"] === NOTIFEE_SERVICE_NAME,
    );
    if (existing) {
      existing.$ = existing.$ ?? {};
      existing.$["android:foregroundServiceType"] = REQUIRED_TYPE;
      existing.$["tools:replace"] = "android:foregroundServiceType";
      return cfg;
    }
    application.service.push({
      $: {
        "android:name": NOTIFEE_SERVICE_NAME,
        "android:foregroundServiceType": REQUIRED_TYPE,
        "tools:replace": "android:foregroundServiceType",
        "tools:node": "merge",
      },
    });
    return cfg;
  });
}

module.exports = withNotifeeForegroundService;
