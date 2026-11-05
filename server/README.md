# Сервер Pokarmanu (PocketBase)

Облако приложения — это [PocketBase](https://pocketbase.io): один файл, внутри база, вход по почте и API.
Сервер стоит в России, данные пользователей хранятся на нём.

Сервер будет отвечать по адресу `api.pokarmanuapp.ru`. Везде ниже замени `SERVER_IP` на IP-адрес своего сервера.

## 1. Что понадобится

- Домен (например, `pokarmanuapp.ru`).
- Виртуальный сервер с Ubuntu 22.04 или 24.04 в российском дата-центре. Хватит 1 ядра и 1 ГБ памяти.
- Почта для писем (Яндекс + пароль приложения).

## 2. Привязать поддомен к серверу

В панели, где куплен домен, добавь DNS-запись:

| Тип | Имя | Значение |
|---|---|---|
| A | `api` | `SERVER_IP` |

Запись начинает работать через 5–30 минут. Проверить: `ping api.pokarmanuapp.ru` должен показать `SERVER_IP`.

## 3. Установить PocketBase

Подключись к серверу (`ssh root@SERVER_IP`) и выполни по очереди:

```bash
apt update && apt install -y unzip
mkdir -p /root/pb && cd /root/pb

# Последняя версия — на https://github.com/pocketbase/pocketbase/releases
# (файл pocketbase_*_linux_amd64.zip). Подставь номер версии:
VERSION=0.40.6
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v$VERSION/pocketbase_${VERSION}_linux_amd64.zip
unzip pocketbase_${VERSION}_linux_amd64.zip && rm pocketbase_${VERSION}_linux_amd64.zip
```

Скопируй папку `server/pb_migrations` из репозитория в `/root/pb/pb_migrations`
(например, со своего компьютера: `scp -r server/pb_migrations root@SERVER_IP:/root/pb/`).
Она создаст таблицу `budget_records` и правила доступа.

Создай ключ шифрования настроек и администратора:

```bash
cd /root/pb
echo "PB_ENCRYPTION_KEY=$(openssl rand -hex 16)" > /root/pb/.env
chmod 600 /root/pb/.env
set -a; . /root/pb/.env; set +a
./pocketbase migrate up --encryptionEnv=PB_ENCRYPTION_KEY
./pocketbase superuser create ТВОЯ_ПОЧТА НАДЁЖНЫЙ_ПАРОЛЬ --encryptionEnv=PB_ENCRYPTION_KEY
```

Файл `.env` с ключом не теряй и никому не показывай: без него сервер не прочитает свои настройки.

## 4. Запуск как службы (с HTTPS)

Создай файл `/lib/systemd/system/pocketbase.service`:

```ini
[Unit]
Description = pocketbase

[Service]
Type = simple
User = root
Group = root
LimitNOFILE = 4096
Restart = always
RestartSec = 5s
EnvironmentFile = /root/pb/.env
StandardOutput = append:/root/pb/std.log
StandardError = append:/root/pb/std.log
WorkingDirectory = /root/pb
ExecStart = /root/pb/pocketbase serve api.pokarmanuapp.ru --encryptionEnv=PB_ENCRYPTION_KEY --origins=https://nancymay.github.io,capacitor://localhost

[Install]
WantedBy = multi-user.target
```

```bash
systemctl enable pocketbase.service
systemctl start pocketbase
systemctl status pocketbase   # должно быть active (running)
```

PocketBase сам получит сертификат Let's Encrypt — порты 80 и 443 должны быть открыты.
`--origins` разрешает запросы к серверу только с сайта приложения и из приложения для iPhone (`capacitor://localhost`).

## 5. Настроить в панели

Открой `https://api.pokarmanuapp.ru/_/` и войди как администратор.

1. **Settings → Application**
   - Application URL: `https://api.pokarmanuapp.ru`
   - Включи **Rate limits** (защита от перебора паролей).
   - Проверь, что **Batch API** включён (его включает миграция).
2. **Settings → Mail settings**
   - Sender name: `Pokarmanu`, Sender address: твоя почта.
   - Use SMTP mail server: включить. Host `smtp.yandex.ru`, Port `465`,
     Username — почта целиком, Password — пароль приложения Яндекса, TLS — включить.
   - Нажми **Send test email**, чтобы проверить.
3. **Settings → Backups** — включи автоматические резервные копии (например, раз в день).
4. **Collections → users → (шестерёнка) → Options → Mail templates** — по желанию переведи письма
   подтверждения почты и сброса пароля на русский.

## 6. Подключить приложение

В репозитории на GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `POCKETBASE_URL`
- Value: `https://api.pokarmanuapp.ru`

Затем **Actions → Deploy to GitHub Pages → Run workflow**, чтобы пересобрать сайт.
В приложении в настройках появится вход в облако.

## Обновление PocketBase

Скачай новую версию в `/root/pb` так же, как в шаге 3, и выполни `systemctl restart pocketbase`.
Перед обновлением сделай резервную копию в панели.
