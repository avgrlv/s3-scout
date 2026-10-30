"""Настройки подключений. Значения секретов не входят в публичную конфигурацию."""

from dataclasses import dataclass
import os
from pathlib import Path
import re
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from dotenv import load_dotenv
import yaml

ROOT = Path(__file__).resolve().parents[1]


class ConfigurationError(ValueError):
    pass


@dataclass(frozen=True)
class Connection:
    id: str
    label: str
    endpoint_url: str
    region: str
    bucket: str
    prefix: str
    credentials_env: str | None
    profile: str | None
    ca_bundle: str | None
    access_key_id: str | None = None
    secret_access_key: str | None = None
    session_token: str | None = None

    def credentials(self):
        if not self.credentials_env:
            return {
                "aws_access_key_id": self.access_key_id,
                "aws_secret_access_key": self.secret_access_key,
                "aws_session_token": self.session_token,
            }
        return {
            name: os.getenv(f"{self.credentials_env}_{suffix}")
            for name, suffix in (
                ("aws_access_key_id", "ACCESS_KEY_ID"),
                ("aws_secret_access_key", "SECRET_ACCESS_KEY"),
                ("aws_session_token", "SESSION_TOKEN"),
            )
        }

    def public(self):
        credentials = self.credentials()
        ready = bool(self.profile) or all(
            credentials.get(name) and not credentials[name].startswith("your_")
            for name in ("aws_access_key_id", "aws_secret_access_key")
        )
        return {
            "id": self.id, "label": self.label, "endpoint": self.endpoint_url,
            "region": self.region, "bucket": self.bucket, "prefix": self.prefix,
            "configured": ready,
            "credentialsSource": f"профиль {self.profile}" if self.profile else self.credentials_env or "сохранённые ключи",
            "authMode": "profile" if self.profile else "env" if self.credentials_env else "keys",
            "credentialsEnv": self.credentials_env or "", "profile": self.profile or "",
            "caBundle": self.ca_bundle or "",
            "hasAccessKey": bool(self.access_key_id),
            "hasSecretKey": bool(self.secret_access_key),
            "hasSessionToken": bool(self.session_token),
        }

    def client(self, endpoint=None, region=None):
        credentials = self.credentials()
        if not self.public()["configured"]:
            raise ConfigurationError(f"Для «{self.label}» не заданы ключи доступа. Открой настройки подключения.")
        return boto3.Session(profile_name=self.profile).client(
            "s3", endpoint_url=endpoint or self.endpoint_url,
            region_name=region or self.region,
            verify=self.ca_bundle or os.getenv("AWS_CA_BUNDLE") or None,
            config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 1}),
            **{key: value for key, value in credentials.items() if value},
        )


def parse_connection(identifier, values):
    if not isinstance(identifier, str) or not isinstance(values, dict):
        raise ConfigurationError("У подключения должны быть строковое имя и настройки.")
    for name in ("label", "endpoint_url", "region", "bucket", "prefix", "profile", "ca_bundle", "credentials_env", "access_key_id", "secret_access_key", "session_token"):
        if values.get(name) is not None and not isinstance(values[name], str):
            raise ConfigurationError(f"Поле {name} должно быть строкой.")
    for name in ("endpoint_url", "region", "bucket"):
        if not isinstance(values.get(name), str) or not values[name].strip():
            raise ConfigurationError(f"Не задано поле {name}.")
    try:
        endpoint = urlparse(values["endpoint_url"].strip())
        port = endpoint.port
    except ValueError:
        raise ConfigurationError("Некорректный адрес endpoint.") from None
    if (endpoint.scheme not in ("https", "http") or not endpoint.hostname
            or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment
            or endpoint.path not in ("", "/") or port == 0):
        raise ConfigurationError("Endpoint должен содержать только протокол и адрес сервера, без бакета.")
    bucket = values["bucket"].strip()
    if any(character in bucket for character in "/\\?#") or any(character.isspace() for character in bucket):
        raise ConfigurationError("Укажи имя бакета без пути и пробелов.")
    profile = values.get("profile") or None
    credential_prefix = values.get("credentials_env") or None
    if profile and credential_prefix:
        raise ConfigurationError("Выбери AWS-профиль или переменные окружения.")
    if credential_prefix and not re.fullmatch(r"[A-Z][A-Z0-9_]*", credential_prefix):
        raise ConfigurationError("Префикс переменных должен выглядеть как AWS или SELECTEL.")
    return Connection(
        id=identifier, label=(values.get("label") or "").strip() or identifier,
        endpoint_url=values["endpoint_url"].strip().rstrip("/"),
        region=values["region"].strip(), bucket=bucket, prefix=values.get("prefix") or "",
        credentials_env=credential_prefix, profile=profile, ca_bundle=values.get("ca_bundle") or None,
        access_key_id=values.get("access_key_id") or None,
        secret_access_key=values.get("secret_access_key") or None,
        session_token=values.get("session_token") or None,
    )


def load_legacy_connections():
    load_dotenv(ROOT / ".env")
    try:
        data = yaml.safe_load((ROOT / "config.yml").read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ConfigurationError("Не удалось прочитать config.yml. Проверь наличие файла и синтаксис YAML.") from error
    if not isinstance(data, dict) or not isinstance(data.get("connections"), dict):
        raise ConfigurationError("В config.yml нужен раздел connections.")
    connections = {}
    for identifier, values in data["connections"].items():
        if not isinstance(values, dict):
            raise ConfigurationError("Настройки подключения должны быть объектом.")
        values = dict(values)
        values.setdefault("credentials_env", None if values.get("profile") else "AWS")
        connections[identifier] = parse_connection(identifier, values)
    default = data.get("default_connection", next(iter(connections), None))
    if default is not None and default not in connections:
        raise ConfigurationError("default_connection не найден в connections.")
    return connections, default


def load_connections():
    from backend.connections import ConnectionStore

    connections, default = ConnectionStore().load()
    if not connections:
        raise ConfigurationError("Подключений пока нет. Запусти S3 Scout и добавь подключение в интерфейсе.")
    return connections, default
