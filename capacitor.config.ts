import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ru.pokarmanuapp.budget",
  appName: "Budget Daily",
  // Built by `npm run build:ios` with a relative base so the files load from the app bundle.
  webDir: "dist",
  ios: {
    // The page handles the notch itself with env(safe-area-inset-*).
    contentInset: "never",
    backgroundColor: "#f4f3f8"
  }
};

export default config;
