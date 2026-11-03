import { useState } from "react";
import type { CloudSync } from "../lib/cloud";
import { useConfirm } from "./ui/ConfirmDialog";
import { Icon } from "./ui/Icon";

const CLOUD_ICON = "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z";
const MIN_PASSWORD = 8;

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function CloudSection({ cloud }: { cloud: CloudSync }) {
  const confirm = useConfirm();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (!cloud.configured) {
    return (
      <div className="field">
        <span className="field-caption">Облако</span>
        <span className="field-hint">Облако пока не подключено — данные хранятся только на этом устройстве.</span>
      </div>
    );
  }

  if (cloud.user) {
    const statusText = {
      syncing: "Синхронизация…",
      synced: cloud.lastSyncedAt ? `Синхронизировано в ${timeLabel(cloud.lastSyncedAt)}` : "Синхронизировано",
      offline: "Нет сети — изменения отправятся позже",
      error: cloud.error || "Ошибка синхронизации",
      signedOut: ""
    }[cloud.status];

    const removeAccount = async () => {
      const ok = await confirm({
        title: "Удалить аккаунт?",
        text: `Аккаунт ${cloud.user?.email ?? ""} и все данные в облаке удалятся безвозвратно. На этом устройстве данные останутся.`,
        confirmText: "Удалить аккаунт"
      });
      if (!ok) {
        return;
      }
      setBusy(true);
      const result = await cloud.deleteAccount();
      setBusy(false);
      setError(result.error ?? "");
    };

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
        <button type="button" className="link-btn link-btn--danger cloud-delete" disabled={busy} onClick={() => void removeAccount()}>
          Удалить аккаунт
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    );
  }

  const cleanEmail = email.trim();
  const emailValid = /^\S+@\S+\.\S+$/.test(cleanEmail);

  const run = async (action: "signIn" | "signUp") => {
    if (!emailValid) {
      setError("Введите почту");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Пароль — минимум ${MIN_PASSWORD} символов`);
      return;
    }
    setBusy(true);
    setInfo("");
    const result = await cloud[action](cleanEmail, password);
    setBusy(false);
    setError(result.error ?? "");
    setInfo(result.info ?? "");
  };

  const forgot = async () => {
    if (!emailValid) {
      setError("Введите почту, на которую придёт ссылка");
      return;
    }
    setBusy(true);
    const result = await cloud.resetPassword(cleanEmail);
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
          placeholder={`Пароль, от ${MIN_PASSWORD} символов`}
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
      <button type="button" className="link-btn cloud-forgot" disabled={busy} onClick={() => void forgot()}>
        Забыли пароль?
      </button>
      {error && <p className="form-error">{error}</p>}
      {info && <p className="field-hint cloud-info">{info}</p>}
    </form>
  );
}
