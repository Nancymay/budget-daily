# Публикация в App Store

Всё, что нужно вписать в [App Store Connect](https://appstoreconnect.apple.com), когда Apple активирует Developer Program.
Лимиты символов указаны в скобках — тексты в них укладываются.

## 1. Создать приложение

App Store Connect → **Apps → «+» → New App**:

| Поле | Значение |
|---|---|
| Platforms | iOS |
| Name (30) | `Pokarmanu` |
| Primary Language | Russian |
| Bundle ID | `ru.pokarmanuapp.budget` (если в Xcode меняла — тот же, что там) |
| SKU | `pokarmanu-ios` |
| User Access | Full Access |

## 2. Страница в магазине (App Information и версия 1.0)

**Subtitle (30):**
```
Бюджет на каждый день
```

**Promotional Text (170):**
```
Одна цифра на каждый день: сколько можно потратить сегодня, чтобы спокойно дожить до зарплаты. Потратили меньше — остаток перейдёт на завтра.
```

**Description (4000):**
```
Pokarmanu делит деньги до зарплаты на дни и каждый день показывает одну цифру — сколько можно потратить сегодня.

ПЕРИОД ОТ ЗАРПЛАТЫ ДО ЗАРПЛАТЫ
Укажите дни зарплаты, например 5-е и 20-е, — приложение посчитает период само. Если зарплата выпадает на выходные, период начнётся с пятницы. Можно считать и по календарным месяцам.

ЛИМИТ НА СЕГОДНЯ
Внесли трату — лимит пересчитался. Потратили меньше — остаток добавится к завтрашнему дню. Видно, сколько останется к концу периода.

ЛИМИТЫ ПО КАТЕГОРИЯМ
Задайте месячный лимит на продукты, кафе или такси — для периода от зарплаты до зарплаты он пересчитается по дням. Если лимит превышен, приложение подскажет.

ВЫПИСКА ИЗ БАНКА
Загрузите выписку Т-Банка (CSV или Excel) — приложение покажет операции, и вы сами выберете, что добавить. Категорию для магазина достаточно выбрать один раз. Файл читается прямо на телефоне и никуда не отправляется.

ОБЛАКО — ПО ЖЕЛАНИЮ
Без аккаунта всё хранится только на устройстве. С аккаунтом бюджет синхронизируется между iPhone и компьютером (pokarmanuapp.ru). Данные хранятся на сервере в России.

БЕЗ РЕКЛАМЫ И ТРЕКЕРОВ
Никакой рекламы, аналитики и продажи данных. Аккаунт удаляется в один клик прямо в приложении.
```

**Keywords (100, через запятую без пробелов):**
```
бюджет,расходы,деньги,зарплата,финансы,лимит,траты,учет,копилка,накопления,кошелек,выписка
```

| Поле | Значение |
|---|---|
| Support URL | `https://pokarmanuapp.ru/support/` |
| Marketing URL | `https://pokarmanuapp.ru` |
| Privacy Policy URL | `https://pokarmanuapp.ru/privacy/` |
| Category | Finance (основная), Productivity (дополнительная) |
| Copyright | `2026 Глушкова Анастасия` |
| Price | Free |
| Age Rating | ответить «None/No» на все вопросы → 4+ |

## 3. Скриншоты

Нужен размер **iPhone 6.9"** (1320 × 2868) — App Store сам уменьшит их для остальных iPhone.
Готовые лежат в архиве `appstore-screenshots.zip` (присланы в чате); порядок: today → operations → categories → add → welcome.

## 4. App Privacy (раздел «Конфиденциальность»)

**Data Collection:** Yes, we collect data from this app.

| Тип данных | Использование | Связаны с пользователем | Трекинг |
|---|---|---|---|
| Contact Info → **Email Address** | App Functionality | Yes | No |
| Financial Info → **Other Financial Info** | App Functionality | Yes | No |
| Identifiers → **User ID** | App Functionality | Yes | No |

Больше ничего не отмечать: нет рекламы, аналитики, геолокации, контактов.

## 5. App Review Information

Apple обязательно проверяет вход, поэтому нужен **демо-аккаунт**:

1. Создай в приложении отдельный аккаунт для проверки (например, на новую почту Яндекса), подтверди почту.
2. Внеси пару операций, чтобы было что смотреть.
3. В App Store Connect → версия → **App Review Information → Sign-in required** → впиши эту почту и пароль.

**Notes (на английском — для проверяющего):**
```
Pokarmanu is a personal daily budget planner. It works fully offline without an account; the account is optional and only syncs the budget between the user's devices.

Demo account is provided above. To test: Settings (⋮ top right) → Cloud. Account deletion: Settings → Cloud → "Удалить аккаунт" (Delete account).

Bank statement import (Settings → Bank) reads a T-Bank CSV/XLSX export locally on the device; nothing is uploaded.
```

Контакт: имя, телефон и почта — свои.

## 6. Загрузить сборку из Xcode

1. В Xcode вверху выбери устройство **Any iOS Device (arm64)**.
2. Меню **Product → Archive**. Через пару минут откроется окно Organizer.
3. **Distribute App → App Store Connect → Upload** → везде «Next» / «Upload».
4. Через 10–30 минут сборка появится в App Store Connect → версия 1.0 → **Build → «+»**.
5. Export Compliance: приложение использует только стандартное шифрование HTTPS — уже отмечено в Info.plist, вопрос не появится.
6. **Add for Review → Submit**. Проверка обычно занимает 1–2 дня.

Для каждой следующей версии увеличь **Version** или **Build** во вкладке General у цели App.
