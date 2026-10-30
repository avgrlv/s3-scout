import {
  ArrowRight,
  Check,
  FolderOpen,
  LoaderCircle,
  Search,
} from "lucide-react";
import type { BrowseMode, BrowsePath, S3Object } from "../../types/storage";
import DirectoryNavigation from "./DirectoryNavigation";
import ObjectTable from "./ObjectTable";

export default function FileList({
  bucket,
  configured,
  browsePath,
  mode,
  items,
  cursor,
  selectedUri,
  searched,
  loading,
  onNavigate,
  onOpen,
  onCopy,
  onResetQuery,
  onLoadMore,
}: {
  bucket: string;
  configured: boolean;
  browsePath: BrowsePath | null;
  mode: BrowseMode | undefined;
  items: S3Object[];
  cursor: string | null;
  selectedUri: string | undefined;
  searched: boolean;
  loading: boolean;
  onNavigate: (uri: string) => void;
  onOpen: (item: S3Object) => void;
  onCopy: (uri: string) => void;
  onResetQuery: () => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="results-card">
      <DirectoryNavigation
        bucket={browsePath?.bucket || bucket}
        prefix={browsePath?.prefix || ""}
        mode={mode}
        count={items.length}
        hasMore={!!cursor}
        searched={searched}
        loading={loading}
        configured={configured}
        onNavigate={onNavigate}
      />
      {browsePath?.prefix === "" && cursor && mode === "folders" && (
        <p className="folder-list-hint">
          Папки тоже загружаются постранично. Чтобы найти нужную, введите начало
          её имени в строку поиска.
        </p>
      )}
      {loading && items.length === 0 ? (
        <div className="empty-state">
          <LoaderCircle size={30} className="spin" />
          <h3>Запрашиваем хранилище</h3>
          <p>Получаем список файлов по вашему префиксу.</p>
        </div>
      ) : !items.length ? (
        <div className="empty-state">
          <div className="empty-illustration">
            <FolderOpen size={37} strokeWidth={1.3} />
            <span>
              <Search size={16} />
            </span>
          </div>
          <h3>
            {searched ? "Папки и файлы не найдены" : "Начните с нужной папки"}
          </h3>
          <p>
            {searched
              ? "Проверьте дату, имя файла и выбранное подключение."
              : "Введите S3-адрес или начало пути — например, папку с документами за нужную дату."}
          </p>
          {searched ? (
            <button className="text-button" onClick={onResetQuery}>
              Вернуться к префиксу подключения <ArrowRight size={14} />
            </button>
          ) : (
            <span className="empty-footnote">
              Файлы загружаются в список только после поиска
            </span>
          )}
        </div>
      ) : (
        <>
          <ObjectTable
            items={items}
            selectedUri={selectedUri}
            prefix={browsePath?.prefix || ""}
            onOpen={onOpen}
            onCopy={onCopy}
          />
          <div className="table-footer">
            <span>Папка — открыть · файл — просмотр</span>
            {cursor ? (
              <button
                className="secondary-button"
                disabled={loading}
                onClick={onLoadMore}
              >
                {loading ? <LoaderCircle size={14} className="spin" /> : null}
                Показать ещё
              </button>
            ) : (
              <span>
                Все результаты загружены <Check size={13} />
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
