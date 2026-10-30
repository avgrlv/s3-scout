# S3 Scout

Локальный браузер S3-совместимых хранилищ: поиск, просмотр и скачивание файлов. Подходит для Yandex Object Storage, Selectel и других хранилищ с S3 API.

## Возможности

- Несколько подключений с настройкой через интерфейс.
- Просмотр папок, навигация по пути и поиск по началу ключа.
- Предпросмотр изображений, PDF и текста, скачивание и копирование S3-адреса.
- Авторизация по ключам, переменным окружения или AWS-профилю.

## Быстрый запуск

Нужен Docker с Compose. Из каталога проекта:

```bash
docker compose up -d --build
```

Открой [S3 Scout](http://127.0.0.1:7890) и добавь подключение: endpoint без имени бакета, регион, бакет и ключи доступа.

Если порт занят:

```bash
S3_DESK_PORT=7892 docker compose up -d
```

В этом случае открой [localhost:7892](http://127.0.0.1:7892). Остановка:

```bash
docker compose down
```

Подключения сохраняются в Docker volume и остаются после пересоздания контейнера.

## Запуск из исходников

Нужны Python 3.10+ и Node.js 24.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
python run.py
```

React собирается автоматически. Другой порт: `python run.py --port 7892`. Остановка — `Ctrl+C`.

Подключения можно задать заранее:

```bash
cp config.example.yml config.yml
cp .env.example .env
```

Заполни свои бакеты и ключи **до первого запуска**. YAML однократно импортируется в SQLite; затем меняй подключения через интерфейс. В Docker шаблоны автоматически не импортируются. Для авторизации через окружение переменные нужно отдельно передать контейнеру.

## Использование

Выбери подключение и введи путь, например `documents/2026-10-27/`. Пустой путь открывает корень; полный `s3://bucket/key` тоже поддерживается.

Нажми папку для перехода внутрь, файл — для предпросмотра. «По папкам» показывает текущий уровень, «Все файлы» — файлы во вложенных папках. Большие списки загружаются постранично.

CLI использует те же подключения:

```bash
python download_s3.py config
python download_s3.py list 's3://my-bucket/documents/' --limit 20
python download_s3.py 's3://my-bucket/documents/file.pdf'
```

## Настройки и ограничения

- Настройки и сохранённые ключи находятся в SQLite: `data/connections.sqlite3`, в Docker — `/data/connections.sqlite3`. Ключи хранятся без дополнительного шифрования.
- Личные `.env`, `config.yml` и `data/` исключены из Git. Для настройки используй [config.example.yml](config.example.yml) и [.env.example](.env.example).
- Приложение предназначено для локального использования одним пользователем.
- Поиск работает по началу ключа, с учётом регистра; поиск по подстроке не поддерживается.
- Нужны права `s3:ListBucket` для списка и `s3:GetObject` для просмотра и скачивания.
- Загрузка и удаление объектов S3 не предусмотрены.

## Разработка

`frontend/` — React + TypeScript + Vite, `backend/` — Python + Flask + boto3.

Для разработки запусти API командой `python -m backend.server --no-browser`, а фронтенд — `npm --prefix frontend run dev`. Проверка сборки: `npm --prefix frontend run build`.
