/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Address of the app's PocketBase server, e.g. https://api.example.ru */
  readonly VITE_POCKETBASE_URL?: string;
  /** "1" when building the iOS app (npm run build:ios). */
  readonly VITE_NATIVE?: string;
}
