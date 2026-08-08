import { App } from "@capacitor/app";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { Style, StatusBar } from "@capacitor/status-bar";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

/**
 * Every helper below degrades to a browser-friendly path, so the same bundle runs
 * unchanged in a desktop browser during development and inside the APK in production.
 */

export async function configureShell() {
    if (!isNative) return;

    try {
        await StatusBar.setStyle({ style: Style.Dark });
        if (platform === "android") {
            await StatusBar.setBackgroundColor({ color: "#08120f" });
            await StatusBar.setOverlaysWebView({ overlay: false });
        }
    } catch {
        // A missing status bar is cosmetic; never block startup on it.
    }
}

export async function hideSplash() {
    if (!isNative) return;
    try {
        await SplashScreen.hide();
    } catch {
        // Ignore: the splash screen auto-hides after its configured timeout.
    }
}

export async function readDeviceInfo() {
    const fallback = {
        platform,
        model: "browser",
        osVersion: navigator.userAgent.slice(0, 40),
        batteryLevel: null,
        charging: null
    };

    if (!isNative) return fallback;

    try {
        const [info, battery] = await Promise.all([Device.getInfo(), Device.getBatteryInfo()]);
        return {
            platform: info.platform,
            model: `${info.manufacturer || ""} ${info.model || ""}`.trim(),
            osVersion: `${info.operatingSystem || ""} ${info.osVersion || ""}`.trim(),
            batteryLevel: typeof battery.batteryLevel === "number" ? Math.round(battery.batteryLevel * 100) : null,
            charging: battery.isCharging ?? null
        };
    } catch {
        return fallback;
    }
}

/**
 * The WebView will not hand getUserMedia a camera until the OS-level permission is
 * held by the app, so this must resolve before any capture attempt.
 */
export async function ensureCameraPermission() {
    if (!isNative) return true;

    try {
        const status = await Camera.checkPermissions();
        if (status.camera === "granted") return true;

        const requested = await Camera.requestPermissions({ permissions: ["camera"] });
        return requested.camera === "granted";
    } catch {
        // If the plugin is unavailable, let getUserMedia surface the real error.
        return true;
    }
}

export async function tap(style = "light") {
    if (!isNative) return;
    try {
        await Haptics.impact({
            style: style === "heavy" ? ImpactStyle.Heavy : style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light
        });
    } catch {
        // Haptics are optional feedback.
    }
}

export function onBackButton(handler) {
    if (!isNative) return () => {};
    const listener = App.addListener("backButton", handler);
    return () => {
        listener.then((item) => item.remove()).catch(() => {});
    };
}

export function onAppStateChange(handler) {
    const listener = isNative ? App.addListener("appStateChange", handler) : null;
    if (!isNative) {
        const visibility = () => handler({ isActive: document.visibilityState === "visible" });
        document.addEventListener("visibilitychange", visibility);
        return () => document.removeEventListener("visibilitychange", visibility);
    }
    return () => {
        listener?.then((item) => item.remove()).catch(() => {});
    };
}

export async function exitApp() {
    if (!isNative) return;
    try {
        await App.exitApp();
    } catch {
        // Nothing sensible to do if the platform refuses to exit.
    }
}

/**
 * Blob downloads do nothing inside an Android WebView, so a snapshot is staged on disk
 * and handed to the system share sheet, which is where the user chooses a real
 * destination (Drive, Files, mail).
 *
 * The cache directory is deliberate: public Documents is unwritable under scoped
 * storage on Android 10+, while the cache dir needs no permission on any version and
 * is already covered by the app's FileProvider paths.
 */
export async function saveAndShareSnapshot(fileName, contents) {
    if (!isNative) {
        const blob = new Blob([contents], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return { shared: false, path: fileName };
    }

    const written = await Filesystem.writeFile({
        path: fileName,
        data: contents,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true
    });

    try {
        // Only `files` is passed: adding `text` makes the intent a text share that
        // some targets then handle without the attachment.
        await Share.share({
            title: "Observer AO snapshot",
            files: [written.uri],
            dialogTitle: "Save or share snapshot"
        });
        return { shared: true, path: written.uri };
    } catch (error) {
        return { shared: false, path: written.uri, reason: error?.message || "cancelled" };
    }
}

/**
 * Preferences survives WebView data clears that would wipe localStorage, so it is the
 * primary store on device with localStorage kept as the browser fallback.
 */
export const storage = {
    async get(key) {
        if (!isNative) return localStorage.getItem(key);
        try {
            const { value } = await Preferences.get({ key });
            return value;
        } catch {
            return null;
        }
    },
    async set(key, value) {
        if (!isNative) {
            try {
                localStorage.setItem(key, value);
            } catch {
                // Quota failures are non-fatal; the session simply is not persisted.
            }
            return;
        }
        try {
            await Preferences.set({ key, value });
        } catch {
            // Ignore storage failures.
        }
    },
    async remove(key) {
        if (!isNative) {
            localStorage.removeItem(key);
            return;
        }
        try {
            await Preferences.remove({ key });
        } catch {
            // Ignore storage failures.
        }
    }
};
