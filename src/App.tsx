import { useEffect, useMemo, useState } from "react";
import { App as AntApp, ConfigProvider, Layout, Tabs, Typography } from "antd";
import { HeaderPanel } from "./components/HeaderPanel";
import { DailyTable } from "./components/DailyTable";
import { TransactionFormModal } from "./components/TransactionFormModal";
import { TransactionsPage } from "./components/TransactionsPage";
import { CategoriesPage } from "./components/CategoriesPage";
import { SummaryPage } from "./components/SummaryPage";
import { BackupMenu } from "./components/BackupMenu";
import { balanceAt, buildForecast } from "./lib/finance";
import { getPeriodFor, getTodayISO, shiftPeriod, type Period } from "./lib/date";
import { getBaseCategories, loadState, saveState } from "./lib/storage";
import type { AppState, DistributionSettings, Transaction, TransactionType } from "./types/models";

const { Content } = Layout;
const baseCategories = getBaseCategories();

type ActiveView = "forecast" | "transactions" | "categories" | "summary";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Date.now());
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [view, setView] = useState<ActiveView>("forecast");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(() => getPeriodFor(getTodayISO(), state.settings.payDays));

  useEffect(() => {
    saveState(state);
  }, [state]);

  const payDays = state.settings.payDays;
  const currentPeriod = getPeriodFor(getTodayISO(), payDays);
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
        distribution: {
          ...state.settings.distribution,
          enabled: true
        }
      }),
    [period, startBalance, state.transactions, state.settings.distribution]
  );

  const editingTransaction = useMemo(
    () => state.transactions.find((tx) => tx.id === editingId) ?? null,
    [state.transactions, editingId]
  );

  // Correcting the balance makes this period's start the new anchor; every other
  // period is carried over from it.
  const setStartBalance = (value: number) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        opening: { date: period.start, amount: Number.isFinite(value) ? value : 0 }
      }
    }));
  };

  const setPayDays = (nextPayDays: number[]) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, payDays: nextPayDays } }));
    setPeriod(getPeriodFor(getTodayISO(), nextPayDays));
  };

  const setDistribution = (distribution: DistributionSettings) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, distribution }
    }));
  };

  const restoreState = (next: AppState) => {
    setEditingId(null);
    setModalOpen(false);
    setState(next);
    setPeriod(getPeriodFor(getTodayISO(), next.settings.payDays));
  };

  const saveTransaction = (payload: Omit<Transaction, "id">, existingId?: string) => {
    setState((prev) => {
      const nextTransactions = existingId
        ? prev.transactions.map((tx) => (tx.id === existingId ? { ...payload, id: existingId } : tx))
        : [...prev.transactions, { ...payload, id: createId() }];

      const type = payload.type;
      const hasCategory = prev.settings.customCategories[type].includes(payload.category);

      return {
        ...prev,
        transactions: nextTransactions,
        settings: hasCategory
          ? prev.settings
          : {
              ...prev.settings,
              customCategories: {
                ...prev.settings.customCategories,
                [type]: [...prev.settings.customCategories[type], payload.category]
              }
            }
      };
    });

    setEditingId(null);
    setModalOpen(false);
  };

  const deleteTransaction = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((tx) => tx.id !== id)
    }));
  };

  const deleteCategory = (type: TransactionType, category: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        customCategories: {
          income:
            type === "income"
              ? prev.settings.customCategories.income.filter((item) => item !== category)
              : prev.settings.customCategories.income,
          expense:
            type === "expense"
              ? prev.settings.customCategories.expense.filter((item) => item !== category)
              : prev.settings.customCategories.expense
        }
      }
    }));
  };

  const addCategory = (type: TransactionType, category: string): boolean => {
    const clean = category.trim();
    if (!clean) {
      return false;
    }

    const exists = mergedCategories[type].some((item) => item.toLowerCase() === clean.toLowerCase());
    if (exists) {
      return false;
    }

    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        customCategories: {
          ...prev.settings.customCategories,
          [type]: [...prev.settings.customCategories[type], clean]
        }
      }
    }));

    return true;
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 12,
          colorPrimary: "#1677ff"
        }
      }}
    >
      <AntApp>
        <Layout className="app-layout">
          <Content className="app-content">
            <div className="app-title-row">
              <Typography.Title level={2} style={{ margin: 0 }}>
                Budget Daily
              </Typography.Title>
              <BackupMenu state={state} onRestore={restoreState} payDays={payDays} onPayDaysChange={setPayDays} />
            </div>

            <HeaderPanel
              period={period}
              isCurrentPeriod={isCurrentPeriod}
              onPrevPeriod={() => setPeriod((p) => shiftPeriod(p, -1, payDays))}
              onNextPeriod={() => setPeriod((p) => shiftPeriod(p, 1, payDays))}
              onCurrentPeriod={() => setPeriod(currentPeriod)}
              startBalance={startBalance}
              onStartBalanceChange={setStartBalance}
              distribution={state.settings.distribution}
              onDistributionChange={setDistribution}
              forecast={forecast}
            />

            <Tabs
              className="main-tabs"
              activeKey={view}
              onChange={(key) => setView(key as ActiveView)}
              items={[
                { key: "forecast", label: "Прогноз по дням" },
                { key: "transactions", label: "Транзакции" },
                { key: "categories", label: "Категории" },
                { key: "summary", label: "Итого" }
              ]}
            />

            {view === "forecast" ? (
              <DailyTable rows={forecast.rows} referenceDate={forecast.referenceDate} />
            ) : view === "transactions" ? (
              <TransactionsPage
                period={period}
                transactions={state.transactions}
                categories={mergedCategories}
                onAdd={() => {
                  setEditingId(null);
                  setModalOpen(true);
                }}
                onEdit={(id) => {
                  setEditingId(id);
                  setModalOpen(true);
                }}
                onDelete={deleteTransaction}
              />
            ) : view === "categories" ? (
              <CategoriesPage
                period={period}
                categories={mergedCategories}
                transactions={state.transactions}
                onAddCategory={addCategory}
                onDeleteCategory={deleteCategory}
              />
            ) : (
              <SummaryPage period={period} transactions={state.transactions} />
            )}

            <TransactionFormModal
              open={modalOpen}
              period={period}
              categories={mergedCategories}
              initial={editingTransaction}
              onClose={() => {
                setEditingId(null);
                setModalOpen(false);
              }}
              onSubmit={saveTransaction}
            />
          </Content>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}
