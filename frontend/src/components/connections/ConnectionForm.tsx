import type { FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import type {
  Connection,
  ConnectionFormValues,
  SetConnectionField,
} from "../../connections";
import ConnectionAuthFields from "./ConnectionAuthFields";

export default function ConnectionForm({
  editing,
  form,
  defaultId,
  busy,
  field,
  save,
  onPreset,
}: {
  editing: Connection | null;
  form: ConnectionFormValues;
  defaultId: string | null;
  busy: string;
  field: SetConnectionField;
  save: (event: FormEvent) => void;
  onPreset: (provider: "yandex" | "selectel") => void;
}) {
  return (
    <form onSubmit={save}>
      <h3>{editing ? "Редактирование подключения" : "Новое подключение"}</h3>
      {!editing && (
        <div className="provider-presets">
          <span>Заполнить адрес:</span>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => onPreset("yandex")}
          >
            Yandex
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => onPreset("selectel")}
          >
            Selectel ru-6
          </button>
        </div>
      )}
      <fieldset disabled={!!busy}>
        <label className="manager-field">
          Название
          <input
            autoFocus
            value={form.label}
            onChange={(event) => field("label", event.target.value)}
            placeholder="Например, рабочее хранилище"
            required
            maxLength={120}
          />
        </label>
        <label className="manager-field">
          Endpoint
          <input
            type="url"
            value={form.endpoint_url}
            onChange={(event) => field("endpoint_url", event.target.value)}
            placeholder="https://storage.example.com"
            required
          />
          <small>Адрес сервера без имени бакета.</small>
        </label>
        <div className="manager-field-row">
          <label className="manager-field">
            Регион
            <input
              value={form.region}
              onChange={(event) => field("region", event.target.value)}
              placeholder="us-east-1"
              required
            />
          </label>
          <label className="manager-field">
            Бакет
            <input
              value={form.bucket}
              onChange={(event) => field("bucket", event.target.value)}
              placeholder="my-bucket"
              required
            />
          </label>
        </div>
        <label className="manager-field">
          Начальная папка <span>необязательно</span>
          <input
            value={form.prefix}
            onChange={(event) => field("prefix", event.target.value)}
            placeholder="documents/ или оставьте пустым для корня"
          />
        </label>
        <ConnectionAuthFields editing={editing} form={form} field={field} />
        <details className="connection-advanced">
          <summary>Дополнительные настройки</summary>
          <label className="manager-field">
            CA bundle
            <input
              value={form.ca_bundle}
              onChange={(event) => field("ca_bundle", event.target.value)}
              placeholder="Необязательный путь к доверенному PEM-файлу"
            />
            <small>
              Путь на сервере; в Docker — внутри контейнера. Проверка TLS
              остаётся включённой.
            </small>
          </label>
        </details>
        <label className="manager-checkbox">
          <input
            type="checkbox"
            checked={form.is_default || editing?.id === defaultId}
            disabled={editing?.id === defaultId}
            onChange={(event) => field("is_default", event.target.checked)}
          />
          Использовать по умолчанию
        </label>
      </fieldset>
      <div className="manager-save">
        <button className="primary-button" disabled={!!busy} type="submit">
          {busy === "save" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Save size={16} />
          )}
          Сохранить подключение
        </button>
      </div>
    </form>
  );
}
