import { useState } from "react";
import type { CloudSync } from "../lib/cloud";
import { Icon } from "./ui/Icon";

const CLOUD_ICON = "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z";

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function CloudSection({ cloud }: { cloud: CloudSync }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

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

  const run = async (action: "signIn" | "signUp") => {
    const cleanEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Введите почту");
      return;
    }
    if (password.length < 6) {
      setError("Пароль — минимум 6 символов");
      return;
    }
    setBusy(true);
    setInfo("");
    const result = await cloud[action](cleanEmail, password);
    setBusy(false);
    setError(result.error ?? "");
    setInfo(result.info ?? "");
  };

  const reset = () => {
    setError("");
    setInfo("");
  };

  return (
    <form
      className="field"
      onSubmit={(event) => {
        event.preventDefault();
        void run("signIn");
      }}
    >
      <span className="field-caption">Облако</span>
      <span className="field-hint">Войди, чтобы данные хранились в облаке и были на всех твоих устройствах.</span>
      <span className="input-wrap">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-label="Почта"
          placeholder="Почта"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            reset();
          }}
        />
      </span>
      <span className="input-wrap">
        <input
          type="password"
          autoComplete="current-password"
          aria-label="Пароль"
          placeholder="Пароль, от 6 символов"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            reset();
          }}
        />
      </span>
      <div className="cloud-actions">
        <button type="submit" className="soft-btn soft-btn--accent" disabled={busy}>
          Войти
        </button>
        <button type="button" className="soft-btn" disabled={busy} onClick={() => void run("signUp")}>
          Создать аккаунт
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {info && <p className="field-hint cloud-info">{info}</p>}
    </form>
  );
}
