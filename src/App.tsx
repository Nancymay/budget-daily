import { useCallback, useEffect, useMemo, useState } from "react";
import { App as AntApp, ConfigProvider } from "antd";
import { TodayPage } from "./components/TodayPage";
import { TransactionsPage } from "./components/TransactionsPage";
import { CategoriesPage } from "./components/CategoriesPage";
import { SummaryPage } from "./components/SummaryPage";
import { TransactionSheet } from "./components/TransactionSheet";
import { CategorySheet, type CategoryDraft, type CategorySheetTarget } from "./components/CategorySheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { DotsIcon, Icon, UI_ICONS } from "./components/ui/Icon";
import { balanceAt, buildForecast } from "./lib/finance";
import { getPeriodFor, getTodayISO, shiftPeriod, type Period } from "./lib/date";
import { periodLabel, periodLabelShort } from "./lib/format";
import { getBaseCategories, loadState, saveState } from "./lib/storage";
import type { AppState, DistributionSettings, PeriodMode, Settings, Transaction, TransactionType } from "./types/models";

const baseCategories = getBaseCategories();

function periodDays(settings: Pick<Settings, "periodMode" | "payDays">): number[] {
  return settings.periodMode === "month" ? [] : settings.payDays;
}

type ActiveView = "today" | "transactions" | "categories" | "summary";

const TABS: { key: ActiveView; label: string; icon: string; title: string }[] = [
  { key: "today", label: "Сегодня", icon: UI_ICONS.calendar, title: "Сегодня" },
  { key: "transactions", label: "Операции", icon: UI_ICONS.list, title: "Операции" },
  { key: "categories", label: "Категории", icon: UI_ICONS.grid, title: "Категории" },
  { key: "summary", label: "Итого", icon: UI_ICONS.chart, title: "Итого" }
];

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Date.now());
}

function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  if (!(from in record)) {
    return record;
  }
  const next = { ...record, [to]: record[from] };
  delete next[from];
  return next;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<ActiveView>("today");
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState<CategorySheetTarget | null>(null);
  const [categoryType, setCategoryType] = useState<TransactionType>("expense");
  const [period, setPeriod] = useState<Period>(() => getPeriodFor(getTodayISO(), periodDays(state.settings)));

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const { payDays, periodMode, categoryStyles } = state.settings;
  // Calendar months are simply periods without paydays.
  const activeDays = periodDays(state.settings);
  const currentPeriod = getPeriodFor(getTodayISO(), activeDays);
  const isCurrentPeriod = currentPeriod.start === period.start;

  const startBalance = useMemo(
    () => balanceAt(period.start, state.settings.opening, state.transactions),
    [period.start, state.settings.opening, state.transactions]
  );

  const mergedCategories: Record<TransactionType, string[]> = useMemo(
    () => ({
      income: [...new Set([...baseCategories.income, ...state.settings.customCategories.income])],
      expense: [...new Set([...baseCategories.expense, ...state.settings.customCategories.expense])]
    }),
    [state.settings.customCategories]
  );

  const forecast = useMemo(
    () =>
      buildForecast({
        period,
        startBalance,
        transactions: state.transactions,
        distribution: { ...state.settings.distribution, enabled: true }
      }),
    [period, startBalance, state.transactions, state.settings.distribution]
  );

  const editingTransaction = useMemo(
    () => state.transactions.find((tx) => tx.id === editingId) ?? null,
    [state.transactions, editingId]
  );

  // Correcting the balance makes this period's start the new anchor; every other period is carried over from it.
  const setStartBalance = (value: number) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, opening: { date: period.start, amount: Number.isFinite(value) ? value : 0 } }
    }));
  };

  const setPayDays = (nextPayDays: number[]) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, payDays: nextPayDays } }));
    setPeriod(getPeriodFor(getTodayISO(), periodDays({ periodMode, payDays: nextPayDays })));
  };

  const setPeriodMode = (mode: PeriodMode) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, periodMode: mode } }));
    // Keep looking at roughly the same dates: the current one if visible, else this period's start.
    const anchor = getTodayISO() >= period.start && getTodayISO() <= period.end ? getTodayISO() : period.start;
    setPeriod(getPeriodFor(anchor, periodDays({ periodMode: mode, payDays })));
  };

  const setDistribution = (distribution: DistributionSettings) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, distribution } }));
  };

  const restoreState = (next: AppState) => {
    setEditingId(null);
    setTxSheetOpen(false);
    setState(next);
    setPeriod(getPeriodFor(getTodayISO(), periodDays(next.settings)));
  };

  const saveTransaction = (payload: Omit<Transaction, "id">, existingId?: string) => {
    setState((prev) => {
      const transactions = existingId
        ? prev.transactions.map((tx) => (tx.id === existingId ? { ...payload, id: existingId } : tx))
        : [...prev.transactions, { ...payload, id: createId() }];
      const known = prev.settings.customCategories[payload.type].includes(payload.category);
      return {
        ...prev,
        transactions,
        settings: known
          ? prev.settings
          : {
              ...prev.settings,
              customCategories: {
                ...prev.settings.customCategories,
                [payload.type]: [...prev.settings.customCategories[payload.type], payload.category]
              }
            }
      };
    });
    setEditingId(null);
    setTxSheetOpen(false);
  };

  const deleteTransaction = (id: string) => {
    setState((prev) => ({ ...prev, transactions: prev.transactions.filter((tx) => tx.id !== id) }));
    setEditingId(null);
    setTxSheetOpen(false);
  };

  const deleteCategory = (type: TransactionType, category: string) => {
    setState((prev) => {
      const categoryStyles = { ...prev.settings.categoryStyles };
      delete categoryStyles[category];
      const categoryLimits = { ...prev.settings.categoryLimits };
      if (type === "expense") {
        delete categoryLimits[category];
      }
      return {
        ...prev,
        settings: {
          ...prev.settings,
          customCategories: {
            ...prev.settings.customCategories,
            [type]: prev.settings.customCategories[type].filter((item) => item !== category)
          },
          categoryLimits,
          categoryStyles
        }
      };
    });
  };

  const saveCategory = (draft: CategoryDraft, previousName?: string): string | null => {
    const name = draft.name;
    if (!name) {
      return "Введите название";
    }
    const taken = mergedCategories[draft.type].some(
      (item) => item !== previousName && item.toLowerCase() === name.toLowerCase()
    );
    if (taken) {
      return "Такая категория уже есть";
    }

    setState((prev) => {
      const { type } = draft;
      const renaming = previousName !== undefined && previousName !== name;
      const list = prev.settings.customCategories[type];
      const customList = previousName !== undefined
        ? list.includes(previousName)
          ? list.map((item) => (item === previousName ? name : item))
          : [...list, name]
        : [...list, name];

      let categoryLimits = renaming && type === "expense" ? renameKey(prev.settings.categoryLimits, previousName, name) : { ...prev.settings.categoryLimits };
      if (type === "expense") {
        categoryLimits = { ...categoryLimits };
        if (draft.monthlyLimit && draft.monthlyLimit > 0) {
          categoryLimits[name] = draft.monthlyLimit;
        } else {
          delete categoryLimits[name];
        }
      }

      const categoryStyles = {
        ...(renaming ? renameKey(prev.settings.categoryStyles, previousName, name) : prev.settings.categoryStyles),
        [name]: draft.style
      };

      return {
        ...prev,
        transactions: renaming
          ? prev.transactions.map((tx) => (tx.type === type && tx.category === previousName ? { ...tx, category: name } : tx))
          : prev.transactions,
        settings: {
          ...prev.settings,
          customCategories: { ...prev.settings.customCategories, [type]: customList },
          categoryLimits,
          categoryStyles
        }
      };
    });
    return null;
  };

  const categoryUsage = useCallback(
    (type: TransactionType, name: string) =>
      state.transactions.reduce(
        (acc, tx) => (tx.type === type && tx.category === name ? { count: acc.count + 1, total: acc.total + tx.amount } : acc),
        { count: 0, total: 0 }
      ),
    [state.transactions]
  );

  const openNewTransaction = () => {
    setEditingId(null);
    setTxSheetOpen(true);
  };

  const prev = () => setPeriod((p) => shiftPeriod(p, -1, activeDays));
  const next = () => setPeriod((p) => shiftPeriod(p, 1, activeDays));
  const tab = TABS.find((item) => item.key === view)!;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#5B3DF5",
          borderRadius: 16,
          fontFamily: "Manrope, system-ui, -apple-system, Segoe UI, sans-serif",
          colorText: "#14131A"
        }
      }}
    >
      <AntApp>
        <div className="app">
          <main className="app-main">
            {view === "today" ? (
              <>
                <header className="top">
                  <div className="brand">
                    <span className="brand-mark">
                      <Icon path={UI_ICONS.trend} size={20} color="#C8F55A" strokeWidth={2.4} />
                    </span>
                    <span className="brand-name">Budget Daily</span>
                  </div>
                  <button type="button" className="icon-btn" aria-label="Меню и настройки" onClick={() => setSettingsOpen(true)}>
                    <DotsIcon />
                  </button>
                </header>
                <div className="period-nav">
                  <button type="button" className="round-btn" aria-label="Предыдущий период" onClick={prev}>
                    <Icon path={UI_ICONS.left} size={18} strokeWidth={2.4} />
                  </button>
                  <div className="period-text">
                    <span className="period-main">{periodLabel(period, periodMode === "month")}</span>
                    {isCurrentPeriod ? (
                      <span className="period-sub">{periodMode === "month" ? "календарный месяц" : "от зарплаты до зарплаты"}</span>
                    ) : (
                      <button type="button" className="link-btn" onClick={() => setPeriod(currentPeriod)}>
                        к текущему периоду
                      </button>
                    )}
                  </div>
                  <button type="button" className="round-btn" aria-label="Следующий период" onClick={next}>
                    <Icon path={UI_ICONS.right} size={18} strokeWidth={2.4} />
                  </button>
                </div>
              </>
            ) : (
              <header className="top">
                <h1 className="page-title">{tab.title}</h1>
                <div className="period-chip">
                  <button type="button" aria-label="Предыдущий период" onClick={prev}>
                    <Icon path={UI_ICONS.left} size={14} strokeWidth={2.8} />
                  </button>
                  <button
                    type="button"
                    className="period-chip-label"
                    onClick={() => setPeriod(currentPeriod)}
                    title={isCurrentPeriod ? undefined : "Вернуться к текущему периоду"}
                  >
                    {periodLabelShort(period)}
                  </button>
                  <button type="button" aria-label="Следующий период" onClick={next}>
                    <Icon path={UI_ICONS.right} size={14} strokeWidth={2.8} />
                  </button>
                </div>
              </header>
            )}

            {view === "today" && (
              <TodayPage period={period} forecast={forecast} distribution={state.settings.distribution} onDistributionChange={setDistribution} />
            )}
            {view === "transactions" && (
              <TransactionsPage
                period={period}
                transactions={state.transactions}
                categories={mergedCategories}
                styles={categoryStyles}
                onEdit={(id) => {
                  setEditingId(id);
                  setTxSheetOpen(true);
                }}
              />
            )}
            {view === "categories" && (
              <CategoriesPage
                type={categoryType}
                onTypeChange={setCategoryType}
                period={period}
                periodMode={periodMode}
                categories={mergedCategories}
                transactions={state.transactions}
                limits={state.settings.categoryLimits}
                styles={categoryStyles}
                onAdd={() => setCategoryTarget({ kind: "add", type: categoryType })}
                onEdit={(type, name) => setCategoryTarget({ kind: "edit", type, name })}
              />
            )}
            {view === "summary" && (
              <SummaryPage period={period} forecast={forecast} transactions={state.transactions} styles={categoryStyles} />
            )}
          </main>

          <nav className="tabbar" aria-label="Разделы">
            {TABS.slice(0, 2).map((item) => (
              <TabButton key={item.key} item={item} active={view === item.key} onClick={() => setView(item.key)} />
            ))}
            <button type="button" className="fab" aria-label="Добавить операцию" onClick={openNewTransaction}>
              <Icon path={UI_ICONS.plus} size={26} strokeWidth={2.8} />
            </button>
            {TABS.slice(2).map((item) => (
              <TabButton key={item.key} item={item} active={view === item.key} onClick={() => setView(item.key)} />
            ))}
          </nav>
        </div>

        <TransactionSheet
          open={txSheetOpen}
          period={period}
          categories={mergedCategories}
          styles={categoryStyles}
          initial={editingTransaction}
          onClose={() => {
            setEditingId(null);
            setTxSheetOpen(false);
          }}
          onSubmit={saveTransaction}
          onDelete={deleteTransaction}
        />
        <CategorySheet
          target={categoryTarget}
          styles={categoryStyles}
          limits={state.settings.categoryLimits}
          usage={categoryUsage}
          onClose={() => setCategoryTarget(null)}
          onSave={saveCategory}
          onDelete={deleteCategory}
        />
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          state={state}
          period={period}
          startBalance={startBalance}
          onStartBalanceChange={setStartBalance}
          onPeriodModeChange={setPeriodMode}
          onPayDaysChange={setPayDays}
          onRestore={restoreState}
        />
      </AntApp>
    </ConfigProvider>
  );
}

function TabButton({ item, active, onClick }: { item: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>
      <Icon path={item.icon} size={22} />
      <span>{item.label}</span>
    </button>
  );
}
