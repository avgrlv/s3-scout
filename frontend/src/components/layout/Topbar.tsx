import { ChevronRight, Settings2, ShieldCheck } from "lucide-react";

export default function Topbar({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="topbar">
      <div>
        <span className="breadcrumb-muted">Рабочее пространство</span>
        <ChevronRight size={14} />
        <span>Обзор файлов</span>
      </div>
      <div className="topbar-actions">
        <button className="settings-button" onClick={onSettings}>
          <Settings2 size={14} />
          Подключения
        </button>
        <span className="local-badge">
          <ShieldCheck size={14} /> Локальный режим
        </span>
      </div>
    </header>
  );
}
