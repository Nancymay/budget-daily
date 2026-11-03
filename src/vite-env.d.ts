/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Address of the app's PocketBase server, e.g. https://api.example.ru */
  readonly VITE_POCKETBASE_URL?: string;
}
