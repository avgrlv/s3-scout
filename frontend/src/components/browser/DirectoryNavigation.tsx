import {
  ArrowUp,
  ChevronRight,
  Folder,
  FolderOpen,
  HardDrive,
  Search,
} from "lucide-react";
import type { BrowseMode } from "../../types/storage";

export default function DirectoryNavigation({
  bucket,
  prefix,
  mode,
  count,
  hasMore,
  searched,
  loading,
  configured,
  onNavigate,
}: {
  bucket: string;
  prefix: string;
  mode: BrowseMode | undefined;
  count: number;
  hasMore: boolean;
  searched: boolean;
  loading: boolean;
  configured: boolean;
  onNavigate: (uri: string) => void;
}) {
  const directoryPrefix = prefix.endsWith("/")
    ? prefix
    : prefix.slice(0, prefix.lastIndexOf("/") + 1);
  const pathParts = directoryPrefix.split("/").filter(Boolean);
  const parentPrefix = pathParts.slice(0, -1).join("/");
  const currentFolder = pathParts.at(-1);
  const nameFilter = prefix.slice(directoryPrefix.length);

  return (
    <>
      <div className="results-header directory-heading">
        <span className="directory-icon">
          {currentFolder ? <FolderOpen size={26} /> : <HardDrive size={25} />}
        </span>
        <div className="directory-title">
          <span className="directory-caption">
            {currentFolder ? "ВЫ НАХОДИТЕСЬ В ПАПКЕ" : "КОРЕНЬ ХРАНИЛИЩА"}
          </span>
          <h2>{currentFolder || bucket || "Выберите подключение"}</h2>
          <p>
            {mode === "files"
              ? "Файлы на всех вложенных уровнях"
              : "Папки и файлы на текущем уровне"}
          </p>
        </div>
        {searched && (
          <span className="directory-count">
            Загружено:{" "}
            <strong>
              {count}
              {hasMore ? "+" : ""}
            </strong>
          </span>
        )}
        {pathParts.length > 0 && (
          <button
            className="secondary-button directory-up"
            disabled={loading}
            onClick={() =>
              onNavigate(
                `s3://${bucket}/${parentPrefix ? parentPrefix + "/" : ""}`,
              )
            }
          >
            <ArrowUp size={15} />
            На уровень выше
          </button>
        )}
      </div>
      <nav className="folder-navigation" aria-label="Путь в хранилище">
        <ol className="folder-breadcrumbs">
          <li>
            <button
              disabled={loading || !configured}
              title="Открыть корень бакета"
              aria-label={`Корень бакета ${bucket}`}
              aria-current={pathParts.length === 0 ? "page" : undefined}
              onClick={() => onNavigate(`s3://${bucket}/`)}
            >
              <HardDrive size={14} />
              <span className="bucket-prefix">Бакет</span>
              {bucket || "Бакет"}
            </button>
          </li>
          {pathParts.map((part, index) => (
            <li key={index}>
              <ChevronRight size={14} aria-hidden="true" />
              {index === pathParts.length - 1 ? (
                <span className="current-folder-crumb" aria-current="page">
                  <FolderOpen size={14} />
                  {part}
                </span>
              ) : (
                <button
                  disabled={loading}
                  onClick={() =>
                    onNavigate(
                      `s3://${bucket}/${pathParts.slice(0, index + 1).join("/")}/`,
                    )
                  }
                >
                  <Folder size={14} />
                  {part}
                </button>
              )}
            </li>
          ))}
        </ol>
        {nameFilter && (
          <span className="name-filter">
            <Search size={12} />
            Фильтр: <code>{nameFilter}</code>
          </span>
        )}
      </nav>
    </>
  );
}
