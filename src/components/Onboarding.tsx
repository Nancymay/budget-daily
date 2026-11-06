import { useMemo, useState, type FormEvent } from "react";
import { CATEGORY_COLORS, CATEGORY_ICONS, type CategoryColor, type CategoryIcon } from "../lib/categoryStyle";
import type { AuthResult, CloudSync } from "../lib/cloud";
import { addDays, diffDays, getPeriodFor, getTodayISO } from "../lib/date";
import { dayMonthLong, groupTypedAmount, num, plural } from "../lib/format";
import type { PeriodMode, Settings } from "../types/models";
import { CategoryBadge } from "./ui/CategoryBadge";
import { CONSENT_REQUIRED, ConsentCheck } from "./ui/Consent";
import { Icon, UI_ICONS } from "./ui/Icon";
import "../styles/onboarding.css";

const ONBOARDED_KEY = "budget-daily.onboarded";

/** Marks onboarding as seen on this device. */
export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {
    // Private mode: onboarding may show again next time, nothing worse.
  }
}

function hasSupabaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i) ?? "";
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Onboarding is only for people who have never used the app on this device:
 * not marked as onboarded, not signed in, and nothing entered yet.
 */
export function shouldShowOnboarding(settings: Settings, transactionCount: number): boolean {
  try {
    if (localStorage.getItem(ONBOARDED_KEY)) {
      return false;
    }
  } catch {
    return false;
  }
  const hasData =
    transactionCount > 0 ||
    settings.opening.amount !== 0 ||
    settings.customCategories.expense.length > 0 ||
    settings.customCategories.income.length > 0 ||
    Object.keys(settings.categoryLimits).length > 0;
  if (hasData || hasSupabaseSession()) {
    // An existing user: never show it to them, now or later.
    markOnboarded();
    return false;
  }
  return true;
}

export interface OnboardingResult {
  periodMode: PeriodMode;
  payDays: number[];
  openingAmount: number;
  limits: { name: string; amount: number; icon: CategoryIcon; color: CategoryColor }[];
}

interface OnboardingProps {
  cloud: CloudSync;
  /** Puts the answers into the app's state (before sign-up, so they sync up with the account). */
  onApply: (result: OnboardingResult) => void;
  /** Closes onboarding for good. */
  onDone: () => void;
}

type Step = "welcome" | "period" | "balance" | "limits" | "ready" | "cloud";
const PROGRESS: Partial<Record<Step, number>> = { period: 1, balance: 2, limits: 3, ready: 4, cloud: 5 };

const PAY_DAY_OPTIONS = [1, 5, 10, 15, 20, 25, 31];

interface LimitDraft {
  name: string;
  icon: CategoryIcon;
  color: CategoryColor;
  amount: string;
  on: boolean;
}

const SUGGESTED_LIMITS: LimitDraft[] = [
  { name: "Продукты", icon: "food", color: "green", amount: "15 000", on: false },
  { name: "Кафе", icon: "cafe", color: "orange", amount: "5 000", on: false },
  { name: "Транспорт", icon: "bus", color: "blue", amount: "3 000", on: false },
  { name: "Развлечения", icon: "ticket", color: "pink", amount: "4 000", on: false }
];

function parseAmount(text: string): number {
  const value = Number(text.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** The share of a monthly limit that falls into the period: each day gets 1/N of its month. */
function limitForPeriod(monthly: number, start: string, end: string): number {
  let total = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const [y, m] = day.split("-").map(Number);
    total += monthly / new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  return total;
}

export function Onboarding({ cloud, onApply, onDone }: OnboardingProps) {
  const today = getTodayISO();
  const [step, setStep] = useState<Step>("welcome");
  const [cameFromWelcome, setCameFromWelcome] = useState(false);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("pay");
  const [payDays, setPayDays] = useState<number[]>([5, 20]);
  const [amountText, setAmountText] = useState("");
  const [limits, setLimits] = useState<LimitDraft[]>(SUGGESTED_LIMITS);
  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const activeDays = periodMode === "month" || payDays.length === 0 ? [] : payDays;
  const period = useMemo(() => getPeriodFor(today, activeDays), [today, activeDays.join(",")]);
  const daysLeft = diffDays(today, period.end) + 1;
  const amount = parseAmount(amountText);
  const perDay = daysLeft > 0 ? Math.floor(amount / daysLeft) : 0;
  const periodEndText = periodMode === "month" ? `до конца месяца` : `до зарплаты ${dayMonthLong(addDays(period.end, 1))}`;

  const go = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const apply = () => {
    onApply({
      periodMode,
      payDays: periodMode === "pay" && payDays.length ? payDays : [5, 20],
      openingAmount: amount,
      limits: limits
        .filter((item) => item.on && parseAmount(item.amount) > 0)
        .map((item) => ({ name: item.name, amount: parseAmount(item.amount), icon: item.icon, color: item.color }))
    });
  };

  const back = () => {
    const order: Step[] = ["welcome", "period", "balance", "limits", "ready", "cloud"];
    if (step === "cloud" && cameFromWelcome) {
      go("welcome");
      return;
    }
    go(order[Math.max(0, order.indexOf(step) - 1)]);
  };

  const progress = PROGRESS[step];
  const showProgress = progress !== undefined && !(step === "cloud" && cameFromWelcome);

  return (
    <div className="ob">
      {step !== "welcome" && (
        <div className="ob-head">
          <button type="button" className="ob-back" aria-label="Назад" onClick={back}>
            <Icon path={UI_ICONS.left} size={20} strokeWidth={2.4} />
          </button>
          {showProgress && (
            <>
              <div className="ob-progress" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={progress}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= progress! ? "is-done" : undefined} />
                ))}
              </div>
              <span className="ob-count">{progress} из 5</span>
            </>
          )}
        </div>
      )}

      {step === "welcome" && (
        <>
          <div className="ob-brand">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={36} height={36} />
            <span>Pokarmanu</span>
          </div>
          <div className="ob-stack" aria-hidden="true">
            <div className="ob-stack-back">
              <span>Завтра</span>
              <strong>+ 1 520 ₽</strong>
            </div>
            <div className="ob-hero">
              <div className="ob-hero-glow" />
              <div className="ob-hero-top">
                <span>Можно тратить сегодня</span>
                <span className="pill pill--lime">ещё 17 дней</span>
              </div>
              <div className="ob-hero-value">
                1 441 <span>₽</span>
              </div>
              <p>Сегодня потрачено 380 ₽ · осталось 1 061 ₽</p>
              <div className="ob-hero-bar">
                <div style={{ width: "26%" }} />
              </div>
            </div>
          </div>
          <h1 className="ob-title">Одна цифра на&nbsp;каждый день</h1>
          <p className="ob-sub">Делим деньги до зарплаты на дни. Потратили меньше — остаток уходит на завтра.</p>
          <div className="ob-grow" />
          <p className="ob-note">
            <Icon path={CLOUD_ICON} size={16} strokeWidth={2} />
            Бюджет в облаке — на всех ваших устройствах
          </p>
          <div className="ob-actions">
            <button type="button" className="primary-btn" onClick={() => go("period")}>
              Начать
            </button>
            <button
              type="button"
              className="ob-link"
              onClick={() => {
                setCameFromWelcome(true);
                go("cloud");
              }}
            >
              У меня уже есть аккаунт
            </button>
          </div>
        </>
      )}

      {step === "period" && (
        <>
          <h1 className="ob-title ob-title--step">Как считать период?</h1>
          <p className="ob-sub">Деньги делятся на дни до следующего поступления.</p>
          <div className="ob-options">
            <div className={`ob-option${periodMode === "pay" ? " is-active" : ""}`}>
              <button type="button" className="ob-option-head" aria-pressed={periodMode === "pay"} onClick={() => setPeriodMode("pay")}>
                <span className="ob-option-icon is-accent">
                  <Icon path="M3 9a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM3 10h18M7 15h3" size={22} strokeWidth={2} />
                </span>
                <span className="ob-option-text">
                  <strong>От зарплаты до зарплаты</strong>
                  <span>Период начинается в день выплаты</span>
                </span>
                <span className="ob-radio" aria-hidden="true" />
              </button>
              {periodMode === "pay" && (
                <div className="ob-option-body">
                  <span className="ob-caption">Дни зарплаты и аванса</span>
                  <div className="ob-chips">
                    {PAY_DAY_OPTIONS.map((day) => {
                      const on = payDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`chip${on ? " is-active" : ""}`}
                          aria-pressed={on}
                          onClick={() =>
                            setPayDays((prev) => (on ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)))
                          }
                        >
                          {day === 31 ? "Последний день" : day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="ob-hint">
                    <Icon path={UI_ICONS.alert} size={16} strokeWidth={2} />
                    Выплата в выходной? Считаем с пятницы.
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              className={`ob-option ob-option-head${periodMode === "month" ? " is-active" : ""}`}
              aria-pressed={periodMode === "month"}
              onClick={() => setPeriodMode("month")}
            >
              <span className="ob-option-icon">
                <Icon path={UI_ICONS.calendar} size={22} strokeWidth={2} />
              </span>
              <span className="ob-option-text">
                <strong>Календарный месяц</strong>
                <span>С 1-го по последнее число</span>
              </span>
              <span className="ob-radio" aria-hidden="true" />
            </button>
          </div>
          <div className="ob-grow" />
          <p className="ob-summary">
            {periodMode === "pay" && payDays.length === 0
              ? "Выберите хотя бы один день"
              : periodMode === "pay"
                ? `Следующая зарплата — ${dayMonthLong(addDays(period.end, 1))}`
                : `Период: до ${dayMonthLong(period.end)}`}
          </p>
          <div className="ob-actions">
            <button type="button" className="primary-btn" disabled={periodMode === "pay" && payDays.length === 0} onClick={() => go("balance")}>
              Дальше
            </button>
          </div>
        </>
      )}

      {step === "balance" && (
        <>
          <h1 className="ob-title ob-title--step">Сколько денег у&nbsp;вас сейчас?</h1>
          <p className="ob-sub">Всё, что можно тратить: карта и наличные. Накопления не считайте.</p>
          <div className="ob-card ob-amount">
            <label htmlFor="ob-opening" className="ob-caption">
              Остаток на утро {dayMonthLong(today)}
            </label>
            <div className="ob-amount-row">
              <input
                id="ob-opening"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountText}
                onChange={(event) => setAmountText(groupTypedAmount(event.target.value))}
              />
              <span>₽</span>
            </div>
            <div className="ob-chips">
              {[10000, 25000, 50000].map((value) => (
                <button key={value} type="button" className="chip chip--soft" onClick={() => setAmountText(groupTypedAmount(String(value)))}>
                  {num(value)}
                </button>
              ))}
            </div>
          </div>
          <div className="ob-preview">
            <span className="ob-preview-text">
              <span>
                {periodMode === "month" ? "До конца месяца" : `До ${dayMonthLong(addDays(period.end, 1))}`} · {daysLeft}{" "}
                {plural(daysLeft, "день", "дня", "дней")}
              </span>
              <strong>Это примерно</strong>
            </span>
            <span className="ob-preview-value">
              {num(perDay)} ₽<small>/день</small>
            </span>
          </div>
          <div className="ob-grow" />
          <p className="ob-summary ob-summary--muted">Остаток можно поправить в любой момент.</p>
          <div className="ob-actions">
            <button type="button" className="primary-btn" onClick={() => go("limits")}>
              Дальше
            </button>
          </div>
        </>
      )}

      {step === "limits" && (
        <>
          <h1 className="ob-title ob-title--step">Лимиты на&nbsp;категории</h1>
          <p className="ob-sub">По желанию. Задайте сумму на месяц — на период пересчитаем сами.</p>
          <div className="ob-card ob-limits">
            {limits.map((item, index) => {
              const look = { path: CATEGORY_ICONS[item.icon].path, ...CATEGORY_COLORS[item.color] };
              const monthly = parseAmount(item.amount);
              const update = (patch: Partial<LimitDraft>) =>
                setLimits((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
              return (
                <div key={item.name} className="ob-limit">
                  <CategoryBadge look={look} size={40} />
                  <span className="ob-limit-text">
                    <strong>{item.name}</strong>
                    <span>
                      {item.on && monthly > 0
                        ? `в месяц · ≈ ${num(limitForPeriod(monthly, period.start, period.end))} ₽ на период`
                        : "Без лимита"}
                    </span>
                  </span>
                  {item.on ? (
                    <span className="ob-limit-input">
                      <input
                        inputMode="decimal"
                        aria-label={`Лимит в месяц: ${item.name}`}
                        value={item.amount}
                        onChange={(event) => update({ amount: groupTypedAmount(event.target.value) })}
                      />
                      <span>₽</span>
                      <button type="button" aria-label={`Убрать лимит: ${item.name}`} onClick={() => update({ on: false })}>
                        <Icon path={UI_ICONS.close} size={14} strokeWidth={2.6} />
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="ob-limit-add" onClick={() => update({ on: true })}>
                      + Лимит
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {addingCustom ? (
            <form
              className="ob-custom"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                const name = customName.trim();
                if (!name || limits.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
                  return;
                }
                setLimits((prev) => [...prev, { name, icon: "star", color: "violet", amount: "", on: true }]);
                setCustomName("");
                setAddingCustom(false);
              }}
            >
              <input autoFocus placeholder="Название категории" aria-label="Название категории" value={customName} onChange={(event) => setCustomName(event.target.value)} />
              <button type="submit" className="soft-btn soft-btn--accent">
                Добавить
              </button>
            </form>
          ) : (
            <button type="button" className="dashed-btn ob-dashed" onClick={() => setAddingCustom(true)}>
              <Icon path={UI_ICONS.plus} size={18} strokeWidth={2.8} />
              Своя категория
            </button>
          )}
          <div className="ob-example">
            <div className="ob-example-top">
              <strong>Кафе</strong>
              <span>4 180 из 5 102 ₽</span>
            </div>
            <div className="ob-example-bar">
              <div />
            </div>
            <span className="ob-example-note">С 80% подсветим жёлтым, при превышении — красным</span>
          </div>
          <div className="ob-grow" />
          <div className="ob-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                apply();
                go("ready");
              }}
            >
              Дальше
            </button>
            <button
              type="button"
              className="ob-link"
              onClick={() => {
                setLimits((prev) => prev.map((item) => ({ ...item, on: false })));
                onApply({ periodMode, payDays: periodMode === "pay" && payDays.length ? payDays : [5, 20], openingAmount: amount, limits: [] });
                go("ready");
              }}
            >
              Пропустить
            </button>
          </div>
        </>
      )}

      {step === "ready" && (
        <>
          <h1 className="ob-title ob-title--step">Готово. Вот ваш лимит на&nbsp;сегодня</h1>
          <div className="hero ob-hero-ready">
            <div className="hero-glow" />
            <div className="hero-top">
              <span className="hero-label">Можно тратить сегодня</span>
              <span className="pill pill--lime">
                ещё {daysLeft} {plural(daysLeft, "день", "дня", "дней")}
              </span>
            </div>
            <div className="hero-value">
              {num(perDay)} <span className="hero-currency">₽</span>
            </div>
            <p className="hero-note">
              {num(amount)} ₽ {periodEndText}
            </p>
            <div className="hero-days" style={{ gridTemplateColumns: `repeat(${Math.max(daysLeft, 1)}, 1fr)` }}>
              {Array.from({ length: Math.max(daysLeft, 1) }, (_, i) => (
                <span key={i} className={i === 0 ? "is-today" : undefined} />
              ))}
            </div>
          </div>
          <ul className="ob-card ob-tips">
            <li>
              <span className="ob-tip-icon is-green">
                <Icon path={UI_ICONS.trend} size={20} />
              </span>
              <span>
                <b>Потратили меньше</b> — завтра лимит вырастет
              </span>
            </li>
            <li>
              <span className="ob-tip-icon is-accent">
                <Icon path="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" size={20} />
              </span>
              <span>
                <b>Пришёл доход</b> — его можно растянуть на несколько дней
              </span>
            </li>
            <li>
              <span className="ob-tip-icon">
                <Icon path={UI_ICONS.alert} size={20} />
              </span>
              <span>
                <b>Подходите к лимиту</b> — категория подсветится жёлтым
              </span>
            </li>
          </ul>
          <div className="ob-grow" />
          <div className="ob-actions">
            <button type="button" className="primary-btn" onClick={() => go("cloud")}>
              Сохранить бюджет
            </button>
          </div>
        </>
      )}

      {step === "cloud" && <CloudStep cloud={cloud} signInFirst={cameFromWelcome} onDone={onDone} />}
    </div>
  );
}

const CLOUD_ICON = "M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z";
const EYE_ICON = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z";

function CloudStep({ cloud, signInFirst, onDone }: { cloud: CloudSync; signInFirst: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<"up" | "in">(signInFirst ? "in" : "up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const isUp = mode === "up";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Введите почту");
      return;
    }
    if (password.length < 8) {
      setError("Пароль — минимум 8 символов");
      return;
    }
    if (isUp && !agreed) {
      setError(CONSENT_REQUIRED);
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    const result: AuthResult = isUp ? await cloud.signUp(cleanEmail, password) : await cloud.signIn(cleanEmail, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.info) {
      // Email confirmation is on: the account exists, sign-in happens after the link.
      setInfo(result.info);
      return;
    }
    onDone();
  };

  const reset = () => {
    setError("");
    setInfo("");
  };

  return (
    <form className="ob-cloud" onSubmit={submit} noValidate>
      <h1 className="ob-title ob-title--step">{isUp ? "Последний шаг — сохраним всё в облаке" : "С возвращением"}</h1>
      <p className="ob-sub">
        {isUp ? "Период, остаток и лимиты будут на всех ваших устройствах." : "Войдите, и бюджет подтянется из облака."}
      </p>

      <div className="ob-segment" role="group" aria-label="Аккаунт">
        <button type="button" className={isUp ? "is-active" : undefined} aria-pressed={isUp} onClick={() => { setMode("up"); reset(); }}>
          Новый аккаунт
        </button>
        <button type="button" className={!isUp ? "is-active" : undefined} aria-pressed={!isUp} onClick={() => { setMode("in"); reset(); }}>
          Уже есть
        </button>
      </div>

      <div className="ob-card ob-fields">
        <label>
          <span>Почта</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@mail.ru"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              reset();
            }}
          />
        </label>
        <label>
          <span>Пароль</span>
          <span className="ob-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={isUp ? "new-password" : "current-password"}
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                reset();
              }}
            />
            <button type="button" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword((v) => !v)}>
              <Icon path={EYE_ICON} size={20} strokeWidth={2} />
            </button>
          </span>
        </label>
        {((isUp && !info) || error) && (
          <div className="ob-consent">
            {isUp && !info && (
              <ConsentCheck
                checked={agreed}
                onChange={(value) => {
                  setAgreed(value);
                  reset();
                }}
              />
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {info ? (
        <p className="ob-info" role="status">
          {info}
        </p>
      ) : (
        <p className="ob-hint ob-hint--plain">
          <span className="ob-tip-icon is-accent">
            <Icon path={CLOUD_ICON} size={18} />
          </span>
          Без сети всё работает, а при связи догоняет облако.
        </p>
      )}

      <div className="ob-grow" />
      <div className="ob-actions">
        {info ? (
          <button type="button" className="primary-btn" onClick={onDone}>
            Перейти к бюджету
          </button>
        ) : (
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Секунду…" : isUp ? "Создать аккаунт и начать" : "Войти"}
          </button>
        )}
        {!signInFirst && !info && (
          <button type="button" className="ob-link" onClick={onDone}>
            Позже, пока только на этом телефоне
          </button>
        )}
      </div>
    </form>
  );
}
