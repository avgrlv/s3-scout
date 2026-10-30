"""Постоянные локальные подключения. Файл БД принадлежит пользователю приложения."""

from contextlib import contextmanager
from dataclasses import asdict
import json
import os
from pathlib import Path
import sqlite3
from uuid import uuid4

from dotenv import load_dotenv

from backend.config import ConfigurationError, ROOT, load_legacy_connections, parse_connection


class ConnectionStore:
    def __init__(self):
        load_dotenv(ROOT / ".env")
        self.directory = Path(os.getenv("S3_DESK_DATA_DIR", ROOT / "data")).expanduser().resolve()
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = self.directory / "connections.sqlite3"
        with self.database() as db:
            db.execute("CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, settings TEXT NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT)")
            db.execute("BEGIN IMMEDIATE")
            if not db.execute("SELECT 1 FROM preferences WHERE key = 'initialized'").fetchone():
                if (ROOT / "config.yml").is_file():
                    connections, default = load_legacy_connections()
                    for connection in connections.values():
                        settings = asdict(connection)
                        identifier = settings.pop("id")
                        db.execute("INSERT INTO connections VALUES (?, ?)", (identifier, json.dumps(settings)))
                    self.set_default(db, default)
                db.execute("INSERT INTO preferences VALUES ('initialized', '1')")
            db.commit()
        self.path.chmod(0o600)

    @contextmanager
    def database(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            yield db
        finally:
            db.close()

    @staticmethod
    def set_default(db, identifier):
        db.execute("INSERT INTO preferences VALUES ('default', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", (identifier,))

    def load(self):
        with self.database() as db:
            db.execute("BEGIN")
            connections = {
                identifier: parse_connection(identifier, json.loads(settings))
                for identifier, settings in db.execute("SELECT id, settings FROM connections ORDER BY rowid")
            }
            row = db.execute("SELECT value FROM preferences WHERE key = 'default'").fetchone()
            default = row[0] if row and row[0] in connections else next(iter(connections), None)
        return connections, default

    def get(self, identifier):
        with self.database() as db:
            row = db.execute("SELECT settings FROM connections WHERE id = ?", (identifier,)).fetchone()
        if row is None:
            raise KeyError(identifier)
        return parse_connection(identifier, json.loads(row[0]))

    def save(self, body, identifier=None):
        if not isinstance(body, dict):
            raise ConfigurationError("Настройки подключения должны быть JSON-объектом.")
        for name in ("is_default", "clear_session_token"):
            if name in body and not isinstance(body[name], bool):
                raise ConfigurationError(f"Поле {name} должно быть логическим значением.")
        with self.database() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = {}
            if identifier is not None:
                row = db.execute("SELECT settings FROM connections WHERE id = ?", (identifier,)).fetchone()
                if row is None:
                    raise KeyError(identifier)
                previous = json.loads(row[0])
            else:
                identifier = uuid4().hex
            values = dict(previous)
            for name in ("label", "endpoint_url", "region", "bucket", "prefix", "ca_bundle", "credentials_env", "profile"):
                if name in body:
                    values[name] = body[name]
            old_mode = "profile" if previous.get("profile") else "env" if previous.get("credentials_env") else "keys"
            mode = body.get("auth_mode", old_mode)
            if mode not in ("keys", "env", "profile"):
                raise ConfigurationError("Неизвестный способ авторизации.")
            for name in ("access_key_id", "secret_access_key", "session_token"):
                value = body.get(name)
                if value is not None and not isinstance(value, str):
                    raise ConfigurationError("Ключи и токен должны быть строками.")
                if value:
                    values[name] = value.strip()
                elif mode != old_mode:
                    values[name] = None
            if body.get("clear_session_token"):
                values["session_token"] = None
            if mode == "keys":
                values["profile"] = values["credentials_env"] = None
                if not values.get("access_key_id") or not values.get("secret_access_key"):
                    raise ConfigurationError("Укажи Access key ID и Secret access key.")
            elif mode == "env":
                values["profile"] = None
                if not values.get("credentials_env"):
                    raise ConfigurationError("Укажи префикс переменных окружения.")
            else:
                values["credentials_env"] = None
                if not values.get("profile"):
                    raise ConfigurationError("Укажи имя AWS-профиля.")
            if mode != "keys":
                for name in ("access_key_id", "secret_access_key", "session_token"):
                    values[name] = None
            connection = parse_connection(identifier, values)
            settings = asdict(connection)
            settings.pop("id")
            db.execute("INSERT INTO connections VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET settings = excluded.settings", (identifier, json.dumps(settings)))
            current = db.execute("SELECT value FROM preferences WHERE key = 'default'").fetchone()
            if body.get("is_default") or not current or not current[0]:
                self.set_default(db, identifier)
            db.commit()
        return connection

    def delete(self, identifier):
        with self.database() as db:
            db.execute("BEGIN IMMEDIATE")
            result = db.execute("DELETE FROM connections WHERE id = ?", (identifier,))
            if not result.rowcount:
                raise KeyError(identifier)
            current = db.execute("SELECT value FROM preferences WHERE key = 'default'").fetchone()
            if current and current[0] == identifier:
                next_row = db.execute("SELECT id FROM connections ORDER BY rowid LIMIT 1").fetchone()
                self.set_default(db, next_row[0] if next_row else None)
            db.commit()
