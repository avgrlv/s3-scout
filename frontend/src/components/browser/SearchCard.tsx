import type { FormEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  File,
  Folder,
  HardDrive,
  LoaderCircle,
  Search,
} from "lucide-react";
import type { Connection } from "../../connections";
import type { BrowseMode } from "../../types/storage";

export default function SearchCard({
  connection,
  connectionsReady,
  query,
  limit,
  mode,
  loading,
  onQueryChange,
  onLimitChange,
  onModeChange,
  onSearch,
  onSettings,
}: {
  connection: Connection | undefined;
  connectionsReady: boolean;
  query: string;
  limit: string;
  mode: BrowseMode;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onModeChange: (value: BrowseMode) => void;
  onSearch: (event: FormEvent) => void;
  onSettings: () => void;
}) {
  return (
    <section className="search-card" aria-label="Поиск файлов">
      <div className="storage-heading">
        <div className="storage-icon">
          <HardDrive size={21} />
        </div>
        <div>
          <strong>
            {connection?.label ||
              (connectionsReady
                ? "Добавьте первое подключение"
                : "Загрузка подключений…")}
          </strong>
          <span>
            {connection
              ? `${connection.endpoint} · ${connection.bucket}`
              : "Настройте хранилище в разделе «Подключения»"}
          </span>
        </div>
        {connection && (
          <span
            className={`credential-badge ${connection.configured ? "" : "not-ready"}`}
          >
            <span
              className={`status-dot ${connection.configured ? "ready" : ""}`}
            />
            {connection.configured ? "Ключи заданы" : "Нужны ключи"}
          </span>
        )}
      </div>
      <form onSubmit={onSearch}>
        <label className="input-label" htmlFor="s3-query">
          Путь в бакете или S3-адрес
        </label>
        <div className="search-line">
          <div className="query-input">
            <Search size={18} />
            <input
              id="s3-query"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="documents/2026-10-27/ · пустой путь откроет корень"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            className="primary-button"
            disabled={loading || !connection?.configured}
            type="submit"
          >
            {loading ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Search size={17} />
            )}
            <span>{loading ? "Ищем…" : "Найти файлы"}</span>
          </button>
        </div>
        <div className="search-options">
          <div
            className="browse-mode"
            role="group"
            aria-label="Режим просмотра"
          >
            {(
              [
                ["folders", "По папкам"],
                ["files", "Все файлы"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={mode === value ? "active" : ""}
                aria-pressed={mode === value}
                disabled={loading}
                onClick={() => onModeChange(value)}
              >
                {value === "folders" ? (
                  <Folder size={12} />
                ) : (
                  <File size={12} />
                )}
                {label}
              </button>
            ))}
          </div>
          <label>
            На страницу{" "}
            <span className="select-wrap">
              <select
                aria-label="Количество файлов на странице"
                value={limit}
                onChange={(event) => onLimitChange(event.target.value)}
              >
                <option>50</option>
                <option>100</option>
                <option>500</option>
                <option>1000</option>
              </select>
              <ChevronDown size={12} />
            </span>
          </label>
        </div>
      </form>
      {connection && !connection.configured && (
        <div className="setup-hint">
          <AlertTriangle size={16} />
          <span>
            У подключения не заданы ключи доступа. Откройте настройки, чтобы
            добавить их или выбрать другой способ авторизации.
          </span>
          <button className="text-button" onClick={onSettings}>
            Настроить
          </button>
        </div>
      )}
    </section>
  );
}
