import { useState } from "react";
import type { FormEvent } from "react";
import type { Connection, ConnectionFormValues } from "../connections";
import { mutateConnection } from "../lib/api";

function blank(): ConnectionFormValues {
  return {
    label: "",
    endpoint_url: "",
    region: "us-east-1",
    bucket: "",
    prefix: "",
    auth_mode: "keys",
    credentials_env: "AWS",
    profile: "",
    access_key_id: "",
    secret_access_key: "",
    session_token: "",
    ca_bundle: "",
    is_default: false,
    clear_session_token: false,
  };
}

export default function useConnectionEditor(
  defaultId: string | null,
  onChanged: (preferred?: string) => Promise<void>,
) {
  const [editing, setEditing] = useState<Connection | null>(null);
  const [form, setForm] = useState<ConnectionFormValues>(blank);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<Connection | null>(null);
  function edit(connection: Connection | null) {
    setEditing(connection);
    setDeleting(null);
    setError("");
    setNotice("");
    setForm(
      connection
        ? {
            ...blank(),
            label: connection.label,
            endpoint_url: connection.endpoint,
            region: connection.region,
            bucket: connection.bucket,
            prefix: connection.prefix,
            auth_mode: connection.authMode,
            credentials_env: connection.credentialsEnv || "AWS",
            profile: connection.profile,
            ca_bundle: connection.caBundle,
            is_default: connection.id === defaultId,
          }
        : blank(),
    );
  }

  function field<K extends keyof ConnectionFormValues>(
    name: K,
    value: ConnectionFormValues[K],
  ) {
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const saved = await mutateConnection<Connection>(
        editing ? `/${editing.id}` : "",
        editing ? "PATCH" : "POST",
        form,
      );
      setEditing(saved);
      setForm((previous) => ({
        ...previous,
        access_key_id: "",
        secret_access_key: "",
        session_token: "",
        clear_session_token: false,
      }));
      await onChanged(saved.id);
      setNotice("Подключение сохранено.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить подключение.",
      );
    } finally {
      setBusy("");
    }
  }

  async function check(connection: Connection) {
    setBusy(`check:${connection.id}`);
    setError("");
    setNotice("");
    try {
      const result = await mutateConnection<{ message: string }>(
        `/${connection.id}/check`,
        "POST",
      );
      setNotice(`${connection.label}: ${result.message}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось проверить подключение.",
      );
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy("delete");
    setError("");
    setNotice("");
    try {
      await mutateConnection(`/${deleting.id}`, "DELETE");
      if (editing?.id === deleting.id) edit(null);
      setDeleting(null);
      await onChanged();
      setNotice("Подключение удалено.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось удалить подключение.",
      );
    } finally {
      setBusy("");
    }
  }

  function confirmDelete(connection: Connection) {
    setDeleting(connection);
    setError("");
    setNotice("");
  }

  function preset(provider: "yandex" | "selectel") {
    setForm((previous) => ({
      ...previous,
      label:
        previous.label ||
        (provider === "yandex" ? "Yandex Object Storage" : "Selectel"),
      endpoint_url:
        provider === "yandex"
          ? "https://storage.yandexcloud.net"
          : "https://s3.ru-6.storage.selcloud.ru",
      region: provider === "yandex" ? "ru-central1" : "ru-6",
    }));
  }

  return {
    editing,
    form,
    busy,
    error,
    notice,
    deleting,
    edit,
    field,
    save,
    check,
    remove,
    confirmDelete,
    preset,
    cancelDelete: () => setDeleting(null),
  };
}
