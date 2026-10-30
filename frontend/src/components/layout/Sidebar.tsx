import {
  Check,
  ChevronRight,
  Compass,
  FolderOpen,
  Settings2,
} from "lucide-react";
import type { Connection } from "../../connections";

export default function Sidebar({
  connections,
  connectionId,
  onConnectionChange,
  onSettings,
}: {
  connections: Connection[];
  connectionId: string;
  onConnectionChange: (connection: Connection) => void;
  onSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="S3 Scout, главная">
        <span className="brand-mark">
          <Compass size={23} strokeWidth={1.6} />
        </span>
        <span>
          S3 Scout<span className="brand-caption">ФАЙЛЫ ПОД РУКОЙ</span>
        </span>
      </a>
      <div className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <div className="nav-active">
        <FolderOpen size={18} /> Обзор файлов <ChevronRight size={15} />
      </div>
      <div className="sidebar-label connections-title">
        ПОДКЛЮЧЕНИЯ <span>{connections.length}</span>
      </div>
      <nav className="connection-list" aria-label="Подключения к хранилищам">
        {connections.map((item) => (
          <button
            key={item.id}
            className={`connection-option ${connectionId === item.id ? "is-active" : ""}`}
            onClick={() => onConnectionChange(item)}
            aria-pressed={connectionId === item.id}
          >
            <span className={`status-dot ${item.configured ? "ready" : ""}`} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.region}</small>
            </span>
            {connectionId === item.id && <Check size={15} />}
          </button>
        ))}
      </nav>
      <button className="sidebar-footer" onClick={onSettings}>
        <Settings2 size={17} />
        <div>
          Подключения<code>Добавить или изменить</code>
        </div>
      </button>
      <div className="local-note">
        <span className="status-dot ready" /> Только на этом компьютере
      </div>
    </aside>
  );
}
