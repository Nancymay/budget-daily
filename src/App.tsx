import { useEffect, useMemo, useState } from "react";
import { HeaderPanel } from "./components/HeaderPanel";
import { DailyTable } from "./components/DailyTable";
import { TransactionFormModal } from "./components/TransactionFormModal";
import { TransactionsPage } from "./components/TransactionsPage";
import { buildForecast } from "./lib/finance";
import { getBaseCategories, loadState, saveState } from "./lib/storage";
import type { AppState, Transaction, TransactionType } from "./types/models";

const baseCategories = getBaseCategories();

type ActiveView = "forecast" | "transactions";

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
    const confirmDelete = window.confirm("Удалить транзакцию?");
    if (!confirmDelete) {
      return;
    }

    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((tx) => tx.id !== id)
    }));
  };

  return (
    <div className="app">
      <h1>Budget Daily</h1>

      <HeaderPanel
        month={month}
        onMonthChange={setMonth}
        startBalance={startBalance}
        onStartBalanceChange={setStartBalance}
        forecast={forecast}
      />

      <div className="tabs">
        <button className={`tab ${view === "forecast" ? "active" : ""}`} onClick={() => setView("forecast")}>
          Прогноз по дням
        </button>
        <button className={`tab ${view === "transactions" ? "active" : ""}`} onClick={() => setView("transactions")}>
          Транзакции
        </button>
      </div>

      {view === "forecast" ? (
        <DailyTable rows={forecast.rows} referenceDate={forecast.referenceDate} />
      ) : (
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
    </div>
  );
}
