import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import type { Connection } from "../../connections";
import useConnectionEditor from "../../hooks/useConnectionEditor";
import ConnectionForm from "./ConnectionForm";
import ConnectionList from "./ConnectionList";

export default function ConnectionsDialog({
  connections,
  defaultId,
  onChanged,
  onClose,
}: {
  connections: Connection[];
  defaultId: string | null;
  onChanged: (preferred?: string) => Promise<void>;
  onClose: () => void;
}) {
  const {
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
    cancelDelete,
    preset,
  } = useConnectionEditor(defaultId, onChanged);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  function keyboard(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const controls = Array.from(
      panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ) || [],
    ).filter((element) => element.offsetParent !== null);
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls[controls.length - 1].focus();
    }
    if (
      !event.shiftKey &&
      document.activeElement === controls[controls.length - 1]
    ) {
      event.preventDefault();
      controls[0].focus();
    }
  }

  return (
    <div className="modal-backdrop" onKeyDown={keyboard}>
      <div
        ref={panel}
        className="connections-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connections-title"
      >
        <header className="connections-dialog-header">
          <div>
            <span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>
            <h2 id="connections-title">Подключения к хранилищам</h2>
            <p>
              Добавьте S3-совместимое хранилище. Настройки сохраняются локально.
            </p>
          </div>
          <button
            className="icon-button"
            disabled={!!busy}
            onClick={onClose}
            aria-label="Закрыть настройки"
          >
            <X size={21} />
          </button>
        </header>
        <div className="connections-dialog-content">
          <ConnectionList
            connections={connections}
            defaultId={defaultId}
            editingId={editing?.id}
            busy={busy}
            onEdit={edit}
            onCheck={check}
            onDelete={confirmDelete}
          />
          <div className="connection-editor">
            {error && (
              <div className="manager-message manager-error" role="alert">
                <AlertTriangle size={17} />
                {error}
              </div>
            )}
            {notice && (
              <div className="manager-message manager-success" role="status">
                <Check size={17} />
                {notice}
              </div>
            )}
            {deleting && (
              <div className="delete-confirmation">
                <strong>Удалить «{deleting.label}»?</strong>
                <p>
                  Удаляется только локальное подключение и его сохранённые
                  ключи.
                </p>
                <div>
                  <button
                    className="danger-button"
                    disabled={!!busy}
                    onClick={remove}
                  >
                    Удалить подключение
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!!busy}
                    onClick={cancelDelete}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
            <ConnectionForm
              editing={editing}
              form={form}
              defaultId={defaultId}
              busy={busy}
              field={field}
              save={save}
              onPreset={preset}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
