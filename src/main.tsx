import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
// Fonts ship with the app: no request to Google (works offline, no visitor IPs sent abroad).
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/cyrillic-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/cyrillic-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/cyrillic-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/cyrillic-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/manrope/cyrillic-800.css";
import "@fontsource/unbounded/latin-500.css";
import "@fontsource/unbounded/cyrillic-500.css";
import "@fontsource/unbounded/latin-600.css";
import "@fontsource/unbounded/cyrillic-600.css";
import "@fontsource/unbounded/latin-700.css";
import "@fontsource/unbounded/cyrillic-700.css";
import "antd/dist/reset.css";
import App from "./App";
import { CookieNotice } from "./components/CookieNotice";
import { initMetrika } from "./lib/metrika";
import "./styles/main.css";

// Inside the iOS app the files come from the app bundle; a service worker isn't needed (or supported) there.
if (import.meta.env.VITE_NATIVE !== "1") {
  registerSW({ immediate: true });
}

initMetrika();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <CookieNotice />
  </React.StrictMode>
);
