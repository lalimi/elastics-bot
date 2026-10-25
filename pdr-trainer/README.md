# Зелена хвиля — тренажер ПДР у Telegram

Особистий Telegram Mini App для підготовки до теоретичного іспиту: пробний іспит (20 питань,
20 хвилин, не більше 2 помилок), тренування, 16 розділів, марафон по всіх 850 питаннях,
робота над помилками, обране, гра «Хто проїде першим?», XP, рівні, серії днів і досягнення.
До 126 питань — анімовані схеми: світлофори, розмітка, переїзди, перехрестя, спецавто, буксирування,
нічне світло й туман.
Бот відповідає лише тим, кому відкрито доступ (власниці й, за бажанням, ще кільком людям), і щовечора о 19:00
за Києвом нагадує кожному, у кого день ще без практики. Прогрес у кожного свій (Telegram CloudStorage).
Без реклами, оплат, аналітики й трекерів.

## Як влаштовано

```
public/                 Mini App (статичні файли)
  index.html
  css/app.css
  js/questions.js       розділи і 850 питань (перший варіант — правильний, на екрані перемішуються)
  js/scenes.js          анімовані SVG-схеми до питань (SCENES: id питання → опис сцени)
  bot/welcome.mp4       анімація, яку бот надсилає на /start
  js/tg.js              обгортка над Telegram.WebApp (працює і в звичайному браузері)
  js/cloud.js           розкладка прогресу по ключах Telegram CloudStorage
  js/app.js             застосунок
src/worker.js           Cloudflare Worker: роздає public/, /webhook бота, /api/activity, cron
src/lib.js              перевірка initData, київський час, текст нагадування
scripts/setup-bot.mjs   setWebhook (із secret_token), кнопка меню «Тренажер», /start
scripts/check-questions.mjs  перевірка бази питань і сцен (запускається перед кожним деплоєм)
scripts/set-avatar.mjs  анімована аватарка бота (assets/avatar.mp4) через setMyProfilePhoto
scripts/make-media.mjs  рендер аватарки й привітальної анімації зі scripts/media/media.html
tests/                  юніт-тести Worker і наскрізні тести в Chromium
```

Один Worker на `*.workers.dev` (HTTPS) і роздає застосунок, і приймає запити бота. Тому все
на одному домені, а оновлення робиться однією командою.

- **Прогрес** зберігається в Telegram CloudStorage (синхронізується між пристроями), localStorage —
  запасний варіант. Ключі: `zh_meta` (загальні дані), `zh_fav*` (обране), `zh_q_<розділ>*`
  (статистика питань). Значення понад 4096 символів автоматично діляться на частини. Запис —
  з дебаунсом і лише змінених ключів; між пристроями перемагає новіший `updatedAt`.
- **Нагадування.** Після першої відповіді за день застосунок надсилає на `/api/activity` свій
  `initData`. Worker перевіряє підпис за документацією Telegram і id власниці, записує в KV дату
  (за Києвом) і серію. Cron запускається щогодини (UTC), а код перевіряє, що в Києві 19:00 —
  тож перехід на літній/зимовий час не збиває час нагадування.
- **Доступ.** `ALLOWED_USER_ID` — один id або кілька через кому, першим — власниця. Незнайомцю бот на `/start`
  відповідає лише його id (щоб власниця могла відкрити доступ), на інше мовчить. Активність і нагадування в KV —
  окремо для кожного: `activity:<id>`, `reminded:<id>`.
- **Секрети** (`BOT_TOKEN`, `WEBHOOK_SECRET`, `ALLOWED_USER_ID`) задаються лише через
  `wrangler secret put` і ніколи не потрапляють у git чи в `public/`.

## Перше розгортання

Потрібні Node.js 20+ і акаунт Cloudflare (безкоштовного плану досить).

```sh
cd pdr-trainer
npm install
npx wrangler login                       # або змінні CLOUDFLARE_API_TOKEN і CLOUDFLARE_ACCOUNT_ID
npx wrangler kv namespace create KV      # скопіюй id у wrangler.toml замість REPLACE_WITH_KV_ID
npm run deploy                           # надрукує адресу https://zelena-khvylia.<subdomain>.workers.dev
```

Бот (новий, через @BotFather → /newbot). Токен не вставляй у файли — лише у змінну середовища:

```sh
read -rs BOT_TOKEN && export BOT_TOKEN   # встав токен і натисни Enter (на екрані не з’явиться)
export WEBHOOK_SECRET=$(openssl rand -hex 32)
export APP_URL=https://zelena-khvylia.<subdomain>.workers.dev/
printf %s "$BOT_TOKEN"      | npx wrangler secret put BOT_TOKEN
printf %s "$WEBHOOK_SECRET" | npx wrangler secret put WEBHOOK_SECRET
npm run setup-bot                        # setWebhook + /start
```

Напиши боту `/start` — він відповість твоїм Telegram id. Закріпи бота за собою і постав кнопку меню:

```sh
export ALLOWED_USER_ID=<твій id>
printf %s "$ALLOWED_USER_ID" | npx wrangler secret put ALLOWED_USER_ID
npm run setup-bot                        # тепер ще й кнопка меню «Тренажер»
npm run set-avatar                       # анімована аватарка бота
```

Після цього `/start` вітає і показує кнопку, а чужим бот лише називає їхній id.

Щоб відкрити доступ ще комусь: людина пише боту `/start` і отримує свій id, далі

```sh
export ALLOWED_USER_ID=<твій id>,<його id>
printf %s "$ALLOWED_USER_ID" | npx wrangler secret put ALLOWED_USER_ID
npm run setup-bot                        # кнопка «Тренажер» у кожного
```

## Оновлення

```sh
npm run deploy
```

Перевіряє базу питань і викладає новий код. Секрети, KV і webhook лишаються як були.

## Сцени до питань

Сцена малює лише ситуацію з умови і ніколи не підказує відповідь. Щоб додати сцену, допиши в `SCENES`
(`public/js/scenes.js`) рядок `id: {…}` — `tl` для світлофора зблизька, `road` для ділянки дороги згори,
`x` для перехрестя. `check-questions.mjs` перевіряє, що питання існує, не має знака і сцена малюється.

Аватарку й привітальну анімацію перегенеровує `npm run media` (потрібні Playwright з Chromium і ffmpeg).

## Розробка і тести

```sh
npm run dev          # http://localhost:8787 — застосунок працює і в звичайному браузері
npm test             # юніт-тести Worker (без мережі)
npm run test:e2e     # усі сценарії в Chromium: звичайний браузер та імітація Telegram
```

Для `test:e2e` потрібен Playwright з Chromium (`npm i -g playwright && npx playwright install chromium`).
Якщо telegram.org недоступний, вкажи копію скрипта: `TG_SDK=/шлях/telegram-web-app.js npm run test:e2e`.

## Питання

Питання складені за чинним текстом ПДР України (Постанова КМУ №1306, редакція зі змінами до
07.10.2026). У поясненнях є посилання на пункти. Це не офіційна база ГСЦ МВС.
`npm run deploy` спершу запускає `scripts/check-questions.mjs`: унікальні id, 2–4 варіанти,
наявні малюнки знаків, жодного порожнього розділу.
