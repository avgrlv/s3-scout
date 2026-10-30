import { LoaderCircle, Plus, Plug, Star, Trash2 } from "lucide-react";
import type { Connection } from "../../connections";

export default function ConnectionList({
  connections,
  defaultId,
  editingId,
  busy,
  onEdit,
  onCheck,
  onDelete,
}: {
  connections: Connection[];
  defaultId: string | null;
  editingId: string | undefined;
  busy: string;
  onEdit: (connection: Connection | null) => void;
  onCheck: (connection: Connection) => void;
  onDelete: (connection: Connection) => void;
}) {
  return (
    <aside className="manage-connections-list">
      <button
        className="secondary-button add-connection"
        disabled={!!busy}
        onClick={() => onEdit(null)}
      >
        <Plus size={16} /> Новое подключение
      </button>
      {!connections.length && (
        <div className="no-connections">
          <Plug size={26} />
          <p>Здесь появятся ваши подключения.</p>
        </div>
      )}
      {connections.map((connection) => (
        <div
          key={connection.id}
          className={`manage-connection ${editingId === connection.id ? "active" : ""}`}
        >
          <button
            className="manage-connection-select"
            disabled={!!busy}
            onClick={() => onEdit(connection)}
          >
            <span
              className={`status-dot ${connection.configured ? "ready" : ""}`}
            />
            <span>
              <strong>{connection.label}</strong>
              <small>{connection.bucket}</small>
            </span>
            {connection.id === defaultId && (
              <Star size={13} aria-label="По умолчанию" />
            )}
          </button>
          <div className="manage-connection-actions">
            <button disabled={!!busy} onClick={() => onCheck(connection)}>
              {busy === `check:${connection.id}` ? (
                <LoaderCircle size={12} className="spin" />
              ) : (
                <Plug size={12} />
              )}
              Проверить
            </button>
            <button
              disabled={!!busy}
              onClick={() => onDelete(connection)}
              aria-label={`Удалить подключение ${connection.label}`}
            >
              <Trash2 size={12} />
              Удалить
            </button>
          </div>
        </div>
      ))}
      <p className="connection-storage-note">
        Настройки и сохранённые ключи остаются на этом компьютере. В Docker они
        хранятся в отдельном volume.
      </p>
    </aside>
  );
}
