import { AlertTriangle, Check, Server, X } from "lucide-react";
import ConnectionsDialog from "./components/connections/ConnectionsDialog";
import FileList from "./components/browser/FileList";
import FilePreview from "./components/browser/FilePreview";
import SearchCard from "./components/browser/SearchCard";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import useClipboard from "./hooks/useClipboard";
import useFileBrowser from "./hooks/useFileBrowser";

export default function App() {
  const browser = useFileBrowser();
  const { toast, copy } = useClipboard();
  const openSettings = () => browser.setSettingsOpen(true);

  return (
    <div className="app-shell">
      <Sidebar
        connections={browser.connections}
        connectionId={browser.connectionId}
        onConnectionChange={browser.changeConnection}
        onSettings={openSettings}
      />
      <main className="workspace">
        <Topbar onSettings={openSettings} />
        <div className="page-content">
          <div className="page-heading">
            <div className="eyebrow">ОБЪЕКТНОЕ ХРАНИЛИЩЕ</div>
            <h1>
              Обзор хранилища<span>.</span>
            </h1>
            <p>Найдите файл, проверьте содержимое и скачайте его из S3.</p>
          </div>
          <SearchCard
            connection={browser.connection}
            connectionsReady={browser.connectionsReady}
            query={browser.query}
            limit={browser.limit}
            mode={browser.mode}
            loading={browser.loading}
            onQueryChange={browser.setQuery}
            onLimitChange={browser.setLimit}
            onModeChange={browser.changeMode}
            onSearch={browser.search}
            onSettings={openSettings}
          />
          {browser.error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              <span>{browser.error}</span>
              <button
                className="icon-button"
                onClick={() => browser.setError("")}
                aria-label="Закрыть сообщение"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <section
            className={`results-layout ${browser.selected ? "with-detail" : ""}`}
          >
            <FileList
              bucket={browser.connection?.bucket || ""}
              configured={!!browser.connection?.configured}
              browsePath={browser.browsePath}
              mode={browser.context?.mode}
              items={browser.items}
              cursor={browser.cursor}
              selectedUri={browser.selected?.uri}
              searched={browser.searched}
              loading={browser.loading}
              onNavigate={browser.navigate}
              onOpen={browser.openItem}
              onCopy={copy}
              onResetQuery={() => {
                browser.setQuery(browser.connection?.prefix || "");
                document.getElementById("s3-query")?.focus();
              }}
              onLoadMore={() => {
                void browser.search(undefined, true);
              }}
            />
            {browser.selected && browser.context && (
              <FilePreview
                selected={browser.selected}
                context={browser.context}
                onClose={() => browser.setSelected(null)}
                onCopy={copy}
              />
            )}
          </section>
          <footer className="page-footer">
            <Server size={13} />
            <span>Настройки подключений сохраняются локально</span>
            <span className="footer-right">S3 Scout / 01</span>
          </footer>
        </div>
      </main>
      {browser.settingsOpen && (
        <ConnectionsDialog
          connections={browser.connections}
          defaultId={browser.defaultConnection}
          onChanged={browser.refreshConnections}
          onClose={() => browser.setSettingsOpen(false)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
