"""Локальный HTTP API и раздача собранного React-приложения."""

import argparse
import re
import threading
from urllib.parse import quote
import webbrowser

from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError, PartialCredentialsError, SSLError
from flask import Flask, Response, jsonify, request, send_from_directory, stream_with_context
from werkzeug.exceptions import HTTPException, NotFound
from werkzeug.serving import make_server

from backend.config import ConfigurationError, ROOT
from backend.connections import ConnectionStore
from backend.storage import inspect_file, list_files, location


def create_app():
    store = ConnectionStore()
    dist = ROOT / "frontend" / "dist"
    app = Flask(__name__, static_folder=str(dist / "assets"), static_url_path="/assets")
    app.config["MAX_CONTENT_LENGTH"] = 32768

    @app.before_request
    def local_requests_only():
        if request.host.split(":", 1)[0] not in ("127.0.0.1", "localhost"):
            return jsonify(error="Доступ разрешён только через localhost."), 403
        origin = request.headers.get("Origin")
        if origin and origin != request.host_url.rstrip("/"):
            return jsonify(error="Запрос с другого сайта запрещён."), 403

    @app.after_request
    def response_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(Exception)
    def handle_error(error):
        if isinstance(error, HTTPException):
            return jsonify(error=error.description), error.code
        status = 502
        if isinstance(error, ClientError):
            code = error.response.get("Error", {}).get("Code", "Unknown")
            if code in ("404", "NoSuchKey", "NotFound", "NoSuchBucket"):
                status, message = 404, "Объект или бакет не найден. Проверь подключение и путь."
            elif code in ("403", "AccessDenied", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredToken", "InvalidToken"):
                status, message = 403, "Хранилище отклонило доступ. Проверь ключи, регион и права на операцию."
            elif code in ("InvalidRange", "416"):
                status, message = 416, "Запрошенный диапазон выходит за границы файла."
            else:
                message = f"Ошибка S3: {code}. Проверь подключение."
        elif isinstance(error, (NoCredentialsError, PartialCredentialsError)):
            status, message = 400, "Ключи доступа не найдены. Проверь .env или AWS-профиль."
        elif isinstance(error, SSLError):
            message = "Не удалось проверить TLS-сертификат. Проверь CA bundle в настройках подключения."
        elif isinstance(error, BotoCoreError):
            message = "Не удалось выполнить запрос к S3. Проверь endpoint, сеть и VPN."
        elif isinstance(error, (ConfigurationError, ValueError)):
            status, message = 400, str(error)
        else:
            status, message = 500, "Внутренняя ошибка при обработке запроса."
            app.logger.error("Request failed: %s", type(error).__name__)
        return jsonify(error=message), status

    def query(allow_empty=False):
        identifier = request.args.get("connection") or store.load()[1]
        try:
            connection = store.get(identifier)
        except KeyError:
            raise NotFound("Подключение не найдено. Выбери его из списка.") from None
        bucket, key = location(connection, request.args.get("query", ""), allow_empty)
        return connection.client(), bucket, key

    @app.get("/api/connections")
    def get_connections():
        connections, default = store.load()
        return jsonify(default=default, connections=[item.public() for item in connections.values()])

    @app.get("/api/health")
    def health():
        return jsonify(status="ok")

    @app.post("/api/connections")
    def create_connection():
        return jsonify(store.save(request.get_json()).public()), 201

    @app.patch("/api/connections/<identifier>")
    def update_connection(identifier):
        try:
            connection = store.save(request.get_json(), identifier)
        except KeyError:
            raise NotFound("Подключение не найдено.") from None
        return jsonify(connection.public())

    @app.delete("/api/connections/<identifier>")
    def delete_connection(identifier):
        try:
            store.delete(identifier)
        except KeyError:
            raise NotFound("Подключение не найдено.") from None
        return "", 204

    @app.post("/api/connections/<identifier>/check")
    def check_connection(identifier):
        try:
            connection = store.get(identifier)
        except KeyError:
            raise NotFound("Подключение не найдено.") from None
        connection.client().list_objects_v2(Bucket=connection.bucket, Prefix=connection.prefix, MaxKeys=1)
        return jsonify(message="Подключение работает. Список объектов доступен.")

    @app.get("/api/objects")
    def get_objects():
        try:
            limit = int(request.args.get("limit", "100"))
        except ValueError:
            raise ValueError("Лимит должен быть целым числом от 1 до 1000.") from None
        if not 1 <= limit <= 1000:
            raise ValueError("Лимит должен быть от 1 до 1000.")
        mode = request.args.get("mode", "folders")
        if mode not in ("folders", "files"):
            raise ValueError("Режим просмотра должен быть folders или files.")
        client, bucket, prefix = query(allow_empty=True)
        return jsonify(list_files(client, bucket, prefix, limit, request.args.get("cursor"), folders=mode == "folders"))

    @app.get("/api/object")
    def get_object():
        client, bucket, key = query()
        return jsonify(inspect_file(client, bucket, key))

    @app.get("/api/text")
    def get_text():
        client, bucket, key = query()
        info = inspect_file(client, bucket, key)
        if info["preview"] != "text":
            raise ValueError("Текстовый просмотр недоступен для этого формата.")
        if info["size"] == 0:
            return jsonify(text="", truncated=False)
        result = client.get_object(Bucket=bucket, Key=key, Range="bytes=0-262143")
        with result["Body"] as stream:
            data = stream.read(262144)
        return jsonify(text=data.decode("utf-8", errors="replace"), truncated="ContentRange" in result and int(result["ContentRange"].split("/")[-1]) > len(data))

    @app.get("/api/file")
    def get_file():
        client, bucket, key = query()
        inline = request.args.get("inline") == "1"
        content_type = "application/octet-stream"
        if inline:
            info = inspect_file(client, bucket, key)
            if info["preview"] not in ("image", "pdf"):
                raise ValueError("Этот файл можно скачать или посмотреть как текст.")
            content_type = info["actualType"]
        arguments = {"Bucket": bucket, "Key": key}
        byte_range = request.headers.get("Range")
        if byte_range:
            if not re.fullmatch(r"bytes=(?:\d+-\d*|-\d+)", byte_range):
                raise ValueError("Некорректный диапазон байт.")
            arguments["Range"] = byte_range
        result = client.get_object(**arguments)
        body = result["Body"]

        def chunks():
            try:
                yield from body.iter_chunks(chunk_size=65536)
            finally:
                body.close()

        response = Response(stream_with_context(chunks()), mimetype=content_type, status=206 if "ContentRange" in result else 200)
        response.call_on_close(body.close)
        response.headers["Content-Length"] = str(result["ContentLength"])
        response.headers["Accept-Ranges"] = "bytes"
        if "ContentRange" in result:
            response.headers["Content-Range"] = result["ContentRange"]
        filename = key.rsplit("/", 1)[-1] or "download"
        disposition = "inline" if inline else "attachment"
        response.headers["Content-Disposition"] = f"{disposition}; filename*=UTF-8''{quote(filename, safe='')}"
        return response

    @app.get("/")
    def index():
        if not (dist / "index.html").is_file():
            return "Фронтенд не собран. Запусти python run.py из корня проекта.", 503
        return send_from_directory(dist, "index.html")

    return app


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=7890)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error("Порт должен быть от 1 до 65535")
    try:
        app = create_app()
    except ConfigurationError as error:
        parser.exit(1, f"Ошибка конфигурации: {error}\n")
    server = make_server("127.0.0.1", args.port, app, threaded=True)
    url = f"http://127.0.0.1:{args.port}"
    print(f"S3 Scout → {url}\nДля остановки нажми Ctrl+C.", flush=True)
    if not args.no_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
