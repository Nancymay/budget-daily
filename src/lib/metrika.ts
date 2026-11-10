/**
 * Yandex Metrica on the website only: not in the iPhone app (App Store privacy answers
 * say "no analytics") and not when no counter is configured. Webvisor stays off so
 * session recordings never capture anyone's budget.
 */
type Ym = ((id: number, method: string, ...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
    ym?: Ym;
  }
}

const COUNTER = Number(import.meta.env.VITE_YM_ID);
const ENABLED = Number.isInteger(COUNTER) && COUNTER > 0 && import.meta.env.VITE_NATIVE !== "1";

export const metrikaEnabled = ENABLED;

export function initMetrika() {
  if (!ENABLED || window.ym) {
    return;
  }
  const ym: Ym = (...args: unknown[]) => {
    (ym.a = ym.a || []).push(args);
  };
  ym.l = Date.now();
  window.ym = ym;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER}`;
  document.head.appendChild(script);
  ym(COUNTER, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false
  });
}

/** A conversion goal; set up goals with the same names in Metrica (type "JavaScript event"). */
export function goal(name: "add_operation" | "sign_up" | "statement_import") {
  if (ENABLED) {
    window.ym?.(COUNTER, "reachGoal", name);
  }
}
