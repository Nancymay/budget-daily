import { useState } from "react";
import { metrikaEnabled } from "../lib/metrika";
import { PRIVACY_URL } from "./ui/Consent";

const KEY = "pokarmanu.cookies-ok";

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** One-time notice about cookies and Yandex Metrica; shown only where Metrica runs (the website). */
export function CookieNotice() {
  const [open, setOpen] = useState(() => metrikaEnabled && !seen());
  if (!open) {
    return null;
  }
  const close = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Private mode: the notice just comes back next time.
    }
    setOpen(false);
  };
  return (
    <div className="cookie-notice" role="region" aria-label="Уведомление о cookies">
      <p>
        Сайт использует cookies и Яндекс Метрику, чтобы понимать, как улучшать приложение. Данные бюджета в Метрику не
        попадают.{" "}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          Подробнее
        </a>
      </p>
      <button type="button" className="soft-btn soft-btn--accent" onClick={close}>
        Понятно
      </button>
    </div>
  );
}
