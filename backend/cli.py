"""Скачивание файлов, просмотр объектов и настроек S3."""

import argparse
import os
from pathlib import Path
import re
import shlex
import sys
import tempfile
import threading
import time
from urllib.parse import unquote, urlparse

from botocore.exceptions import (
    BotoCoreError, ClientError, ConnectTimeoutError, EndpointConnectionError,
    NoCredentialsError, PartialCredentialsError, ReadTimeoutError, SSLError,
)
from dotenv import load_dotenv

from backend.config import ConfigurationError, ROOT, load_connections


def parse_s3_url(value, endpoint=None, allow_empty_key=False):
    url = urlparse(value)
    if url.scheme == "s3":
        bucket, key = url.netloc, url.path[1:]
    elif url.scheme == "https":
        host = url.hostname or ""
        virtual_host = re.fullmatch(
            r"(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?", host
        )
        path_host = re.fullmatch(
            r"s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?", host
        )
        custom_host = endpoint and url.netloc == urlparse(endpoint).netloc
        if virtual_host:
            bucket, key = virtual_host.group(1), unquote(url.path[1:])
        elif path_host or custom_host:
            bucket, separator, key = unquote(url.path[1:]).partition("/")
            if not separator and not allow_empty_key:
                raise ValueError("В URL отсутствует ключ объекта")
        else:
            raise ValueError(
                "Используй s3://bucket/key, HTTPS URL AWS S3 или "
                "HTTPS URL вида endpoint/bucket/key с --endpoint-url"
            )
    else:
        raise ValueError("Ожидается s3://bucket/key или HTTPS URL S3")
    if not bucket or (not key and not allow_empty_key):
        raise ValueError("В URL должны присутствовать бакет и ключ объекта")
    return bucket, key


def add_storage_options(parser):
    parser.add_argument("--connection", help="ID подключения из локального S3 Scout")
    parser.add_argument(
        "--endpoint-url", help="Переопределить endpoint выбранного подключения",
    )
    parser.add_argument(
        "--region", help="Переопределить регион выбранного подключения",
    )


def positive_int(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("Значение должно быть больше нуля")
    return number


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog="Прежний вызов поддерживается: python download_s3.py s3://bucket/key [output]",
    )
    commands = parser.add_subparsers(dest="command", required=True)
    download = commands.add_parser("download", help="Скачать файл")
    download.add_argument("url", help="s3://bucket/key или HTTPS URL объекта")
    download.add_argument("output", nargs="?", help="Путь для сохранения файла")
    listing = commands.add_parser("list", help="Показать объекты по префиксу")
    listing.add_argument("url", help="s3://bucket[/prefix] или HTTPS URL")
    listing.add_argument(
        "--limit", type=positive_int, default=100,
        help="Максимум объектов в выводе (по умолчанию 100)",
    )
    config = commands.add_parser("config", help="Показать настройки без секретов")
    for command in (download, listing, config):
        add_storage_options(command)
    # Сохраняем исходный интерфейс, в том числе опции перед URL.
    if argv and argv[0] not in ("download", "list", "config", "-h", "--help"):
        argv = ["download", *argv]
    args = parser.parse_args(argv)
    try:
        connections, default = load_connections()
    except ConfigurationError as error:
        parser.error(str(error))
    identifier = args.connection or default
    if identifier not in connections:
        parser.error(f"Неизвестное подключение {identifier}. Доступны: {', '.join(connections)}")
    args.storage_connection = connections[identifier]
    args.connection = identifier
    args.endpoint_url = args.endpoint_url or args.storage_connection.endpoint_url
    args.region = args.region or args.storage_connection.region
    if args.command != "config":
        try:
            args.bucket, args.key = parse_s3_url(
                args.url, args.endpoint_url, allow_empty_key=args.command == "list",
            )
        except ValueError as error:
            parser.error(str(error))
    if args.command == "download":
        filename = args.key.rsplit("/", 1)[-1]
        if not args.output and filename in ("", ".", ".."):
            parser.error("Укажи путь для сохранения вторым аргументом")
    return args


def format_size(size):
    for unit in ("Б", "КиБ", "МиБ", "ГиБ", "ТиБ"):
        if size < 1024 or unit == "ТиБ":
            return f"{size:.0f} {unit}" if unit == "Б" else f"{size:.1f} {unit}"
        size /= 1024


def display_endpoint(endpoint):
    if not endpoint:
        return "AWS S3 (выбирается по региону)"
    try:
        url = urlparse(endpoint)
    except ValueError:
        return "некорректный URL"
    return url._replace(
        netloc=url.netloc.rsplit("@", 1)[-1], query="", fragment="",
    ).geturl()


def show_config(args, env_path):
    print(f"Файл настроек: {env_path} ({'есть' if env_path.is_file() else 'отсутствует'})")
    print(f"Endpoint: {display_endpoint(args.endpoint_url)}")
    print(f"Регион: {args.region}")
    print(f"Подключение: {args.connection} ({args.storage_connection.label})")
    print(f"Бакет: {args.storage_connection.bucket}")
    print(f"Ключи: {args.storage_connection.public()['credentialsSource']}")
    print(f"Настроены: {'да' if args.storage_connection.public()['configured'] else 'нет'}")
    print(f"CA bundle: {args.storage_connection.ca_bundle or os.getenv('AWS_CA_BUNDLE') or 'по умолчанию boto3'}")
    if args.endpoint_url and urlparse(args.endpoint_url).path not in ("", "/"):
        print("В endpoint есть путь: проверь, что имя бакета не включено в S3_ENDPOINT_URL.")
    print("Переменные окружения имеют приоритет над .env.")
    print("Наличие ключей не подтверждает доступ. Запросы в S3 не выполняются.")


class DownloadProgress:
    def __init__(self, total):
        self.total = total
        self.downloaded = 0
        self.updated = 0
        self.enabled = sys.stderr.isatty()
        self.lock = threading.Lock()

    def __call__(self, amount):
        if not self.enabled:
            return
        with self.lock:
            self.downloaded = max(0, self.downloaded + amount)
            now = time.monotonic()
            if now - self.updated < 0.2 and self.downloaded < self.total:
                return
            self.updated = now
            percent = min(100, self.downloaded / self.total * 100) if self.total else 100
            print(
                f"\rСкачано: {format_size(self.downloaded)} / "
                f"{format_size(self.total)} ({percent:.0f}%)",
                end="", file=sys.stderr, flush=True,
            )

    def finish(self):
        if self.enabled:
            print(file=sys.stderr)


def download_file(s3, args):
    filename = args.key.rsplit("/", 1)[-1]
    output = Path(args.output or filename).expanduser()
    metadata = s3.head_object(Bucket=args.bucket, Key=args.key)
    print(
        f"Скачивание: s3://{args.bucket}/{args.key} ({format_size(metadata['ContentLength'])})",
        file=sys.stderr,
    )
    progress = DownloadProgress(metadata["ContentLength"])

    temporary = None
    try:
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=output.parent, prefix=".s3-download-", delete=False,
        ) as file:
            temporary = Path(file.name)
        progress(0)
        s3.download_file(args.bucket, args.key, str(temporary), Callback=progress)
        os.replace(temporary, output)
    finally:
        progress.finish()
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(f"Файл сохранён: {output.resolve()}")


def list_objects(s3, args):
    pages = s3.get_paginator("list_objects_v2").paginate(
        Bucket=args.bucket, Prefix=args.key,
        PaginationConfig={"MaxItems": args.limit + 1, "PageSize": min(args.limit + 1, 1000)},
    )
    count = 0
    for page in pages:
        for item in page.get("Contents", []):
            if count == args.limit:
                print(
                    f"Показано первых {count} объектов. Увеличь --limit или уточни префикс.",
                    file=sys.stderr,
                )
                return
            print(f"{format_size(item['Size']):>12}  s3://{args.bucket}/{item['Key']}")
            count += 1
    if count:
        print(f"Найдено объектов: {count}", file=sys.stderr)
    else:
        print(f"Объекты не найдены: s3://{args.bucket}/{args.key}")
        print(f"Endpoint: {display_endpoint(s3.meta.endpoint_url)}")


def report_error(error, args, s3):
    code = error.response.get("Error", {}).get("Code", "Unknown") if isinstance(error, ClientError) else None
    if isinstance(error, ConfigurationError):
        message = str(error)
    elif isinstance(error, ClientError):
        if code == "NoSuchBucket":
            message = "Бакет не найден. Проверь имя бакета и endpoint."
        elif code in ("404", "NoSuchKey", "NotFound"):
            message = "Объект или бакет не найден (404). Проверь путь и хранилище."
        elif code in ("403", "AccessDenied"):
            message = "Доступ запрещён (403). Проверь ключи и права на эту операцию."
        elif code in ("InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken", "InvalidToken"):
            message = f"Ошибка авторизации ({code}). Проверь ключи, токен и регион."
        else:
            message = f"S3 вернул ошибку {code}."
    elif isinstance(error, (NoCredentialsError, PartialCredentialsError)):
        message = "Не найдены полные ключи доступа. Заполни AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY в .env или настрой AWS-профиль."
    elif isinstance(error, SSLError):
        message = "Не удалось проверить TLS-сертификат. Проверь AWS_CA_BUNDLE и доверенные сертификаты."
    elif isinstance(error, (EndpointConnectionError, ConnectTimeoutError, ReadTimeoutError)):
        message = "Не удалось подключиться к S3 или истекло время ожидания. Проверь endpoint, сеть и VPN."
    elif isinstance(error, OSError):
        message = f"Ошибка локального файла: {error}"
    elif isinstance(error, ValueError):
        message = "Некорректные настройки. Проверь endpoint и регион."
    else:
        message = f"Ошибка конфигурации или соединения ({type(error).__name__}). Проверь настройки командой config."
    print(f"Ошибка: {message}", file=sys.stderr)
    endpoint = s3.meta.endpoint_url if s3 is not None else args.endpoint_url
    print(f"Endpoint: {display_endpoint(endpoint)}", file=sys.stderr)
    if args.command != "config":
        print(f"Бакет: {args.bucket}\nКлюч/префикс: {args.key}", file=sys.stderr)
    if code in ("404", "NoSuchKey", "NotFound") and args.command == "download":
        prefix = args.key.rpartition("/")[0]
        url = f"s3://{args.bucket}/{prefix + '/' if prefix else ''}"
        command = ["python", Path(__file__).name, "list", url]
        command[1] = "download_s3.py"
        command.extend(["--connection", args.connection])
        if args.endpoint_url:
            command.extend(["--endpoint-url", display_endpoint(args.endpoint_url)])
        if args.region:
            command.extend(["--region", args.region])
        print(f"Посмотреть соседние объекты:\n  {shlex.join(command)}", file=sys.stderr)


def main():
    env_path = ROOT / ".env"
    load_dotenv(env_path)
    args = parse_args(sys.argv[1:])
    s3 = None
    try:
        if args.command == "config":
            show_config(args, env_path)
            return 0
        s3 = args.storage_connection.client(endpoint=args.endpoint_url, region=args.region)
        if args.command == "list":
            list_objects(s3, args)
        else:
            download_file(s3, args)
    except (BotoCoreError, ClientError, OSError, ValueError) as error:
        report_error(error, args, s3)
        return 1
    except KeyboardInterrupt:
        print("\nОперация прервана.", file=sys.stderr)
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
