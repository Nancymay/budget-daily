import { useState } from "react";
import type { CloudSync } from "../lib/cloud";
import { Icon } from "./ui/Icon";

const CLOUD_ICON = "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z";

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function CloudSection({ cloud }: { cloud: CloudSync }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (cloud.user) {
    const statusText = {
      syncing: "Синхронизация…",
      synced: cloud.lastSyncedAt ? `Синхронизировано в ${timeLabel(cloud.lastSyncedAt)}` : "Синхронизировано",
      offline: "Нет сети — изменения отправятся позже",
      error: cloud.error || "Ошибка синхронизации",
      signedOut: ""
    }[cloud.status];

    return (
      <div className="field">
        <span className="field-caption">Облако</span>
        <div className="cloud-card">
          <span className={`menu-icon cloud-icon is-${cloud.status}`}>
            <Icon path={CLOUD_ICON} size={20} strokeWidth={2.2} />
          </span>
          <span className="menu-text">
            <strong>{cloud.user.email}</strong>
            <span className={cloud.status === "error" ? "warn-text" : undefined} role="status">
              {statusText}
            </span>
          </span>
        </div>
        <div className="cloud-actions">
          <button type="button" className="soft-btn" onClick={cloud.syncNow} disabled={cloud.status === "syncing"}>
            Синхронизировать
          </button>
          <button type="button" className="soft-btn" onClick={() => void cloud.signOut()}>
            Выйти
          </button>
        </div>
        <span className="field-hint">Данные остаются и на телефоне: без сети всё работает, а при связи догоняет облако.</span>
      </div>
    );
  }

  const send = async () => {
    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError("Введите почту");
      return;
    }
    setBusy(true);
    const result = await cloud.sendCode(clean);
    setBusy(false);
    if (result) {
      setError(result);
    } else {
      setError("");
      setStep("code");
    }
  };

  const verify = async () => {
    const clean = code.replace(/\D/g, "");
    if (clean.length < 6) {
      setError("Введите код из письма");
      return;
    }
    setBusy(true);
    const result = await cloud.verifyCode(email.trim(), clean);
    setBusy(false);
    setError(result ?? "");
  };

  return (
    <div className="field">
      <span className="field-caption">Облако</span>
      {step === "email" ? (
        <>
          <span className="field-hint">Войди по почте, чтобы данные хранились в облаке и были на всех твоих устройствах.</span>
          <span className="input-wrap">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-label="Почта"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => event.key === "Enter" && void send()}
            />
          </span>
          <button type="button" className="soft-btn soft-btn--accent" onClick={() => void send()} disabled={busy}>
            {busy ? "Отправляю…" : "Получить код для входа"}
          </button>
        </>
      ) : (
        <>
          <span className="field-hint">
            Код отправлен на {email.trim()}. Введи его здесь — так вход сработает и в приложении на экране «Домой».
          </span>
          <span className="input-wrap">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Код из письма"
              placeholder="Код из письма"
              maxLength={10}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ""));
                setError("");
              }}
              onKeyDown={(event) => event.key === "Enter" && void verify()}
            />
          </span>
          <button type="button" className="soft-btn soft-btn--accent" onClick={() => void verify()} disabled={busy}>
            {busy ? "Проверяю…" : "Войти"}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
          >
            Другая почта или отправить код ещё раз
          </button>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
