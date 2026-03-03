import { useEffect, useMemo, useState } from "react";
import { ConfigProvider, Layout, Tabs, Typography } from "antd";
import { HeaderPanel } from "./components/HeaderPanel";
import { DailyTable } from "./components/DailyTable";
import { TransactionFormModal } from "./components/TransactionFormModal";
import { TransactionsPage } from "./components/TransactionsPage";
import { CategoriesPage } from "./components/CategoriesPage";
import { SummaryPage } from "./components/SummaryPage";
import { buildForecast } from "./lib/finance";
import { getBaseCategories, loadState, saveState } from "./lib/storage";
import type { AppState, Transaction, TransactionType } from "./types/models";

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

  useEffect(() => {
    saveState(state);
  }, [state]);

  const month = state.settings.month;
  const startBalance = state.settings.startBalanceByMonth[month] ?? 0;

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
        month,
        startBalance,
        transactions: state.transactions,
        distribution: {
          ...state.settings.distribution,
          enabled: true
        }
      }),
    [month, startBalance, state.transactions, state.settings.distribution]
  );

  const editingTransaction = useMemo(
    () => state.transactions.find((tx) => tx.id === editingId) ?? null,
    [state.transactions, editingId]
  );

  const setMonth = (nextMonth: string) => {
    if (!nextMonth) {
      return;
    }

    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        month: nextMonth,
        startBalanceByMonth: {
          ...prev.settings.startBalanceByMonth,
          [nextMonth]: prev.settings.startBalanceByMonth[nextMonth] ?? 0
        }
      }
    }));
  };

  const setStartBalance = (value: number) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        startBalanceByMonth: {
          ...prev.settings.startBalanceByMonth,
          [prev.settings.month]: Number.isFinite(value) ? value : 0
        }
      }
    }));
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
      <Layout className="app-layout">
        <Content className="app-content">
          <Typography.Title level={2} style={{ marginTop: 0 }}>
            Budget Daily
          </Typography.Title>

          <HeaderPanel
            month={month}
            onMonthChange={setMonth}
            startBalance={startBalance}
            onStartBalanceChange={setStartBalance}
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
              month={month}
              categories={mergedCategories}
              transactions={state.transactions}
              onAddCategory={addCategory}
              onDeleteCategory={deleteCategory}
            />
          ) : (
            <SummaryPage month={month} transactions={state.transactions} />
          )}

          <TransactionFormModal
            open={modalOpen}
            month={month}
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
    </ConfigProvider>
  );
}
