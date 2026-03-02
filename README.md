# Budget Daily (PWA)

Минималистичное offline-first PWA для ежедневного контроля бюджета:
- доходы/расходы;
- стартовый баланс по месяцам;
- прогноз остатков по каждому дню месяца;
- дневной лимит и проекция остатка;
- распределение конкретного дохода по диапазону дат.

## Stack

- Vite + React + TypeScript
- `vite-plugin-pwa` (`registerType: autoUpdate`)
- Хранение: `localStorage`

## Запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

Результат будет в `dist/`.

## PWA и offline

- Service worker регистрируется в `src/main.tsx` через `virtual:pwa-register`.
- После первого открытия и кэширования статических ассетов приложение работает офлайн.

## Деплой на GitHub Pages

1. Для репозитория вида `https://github.com/<user>/<repo>` выстави `base` через переменную:

```bash
VITE_BASE_PATH=/<repo>/ npm run build
```

2. Публикация в ветку `gh-pages`:

```bash
npm run deploy
```

По умолчанию `deploy` использует содержимое `dist/`.

## Структура данных

```ts
settings: {
  month: "YYYY-MM";
  startBalanceByMonth: Record<string, number>;
  distribution: {
    enabled: boolean;
    mode: "fromStart" | "fromToday" | "fromDate";
    fromDate?: string;
  };
  customCategories: {
    income: string[];
    expense: string[];
  };
}

transactions: Array<{
  id: string;
  type: "income" | "expense";
  date: "YYYY-MM-DD";
  amount: number;
  category: string;
  note?: string;
  spread?: {
    enabled: boolean;
    startDate: "YYYY-MM-DD";
    endDate: "YYYY-MM-DD";
  };
}>;
```

## Алгоритм расчёта таблицы дней

1. Генерируются все дни выбранного месяца.
2. Для каждого дня считаются суммы `income/expense`.
   - Обычный доход учитывается в дату транзакции.
   - Доход с `spread.enabled=true` делится равномерно по диапазону `startDate..endDate`.
3. По дням в хронологии:
   - `balanceStart = startBalance` (для первого дня) или `balanceEnd` предыдущего дня.
   - `balanceEnd = balanceStart + income - expense`.
4. Если включено распределение:
   - выбирается точка отсчёта (`fromStart`/`fromToday`/`fromDate`);
   - `distBase = balanceStart(на точке) + income(от точки до конца) - expense(от точки до конца)`;
   - `dailyLimit = distBase / daysLeft`;
   - `projectedEnd` для дня `k` от точки: `distBase - dailyLimit * k`.
5. Все денежные значения округляются до 2 знаков.
