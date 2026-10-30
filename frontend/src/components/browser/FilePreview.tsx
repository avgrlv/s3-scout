import {
  AlertTriangle,
  ArrowDownToLine,
  Copy,
  File,
  FileText,
  LoaderCircle,
  X,
} from "lucide-react";
import type { S3File, SearchContext } from "../../types/storage";
import { date, size } from "../../lib/format";
import useFilePreview from "../../hooks/useFilePreview";
import FileIcon from "../FileIcon";

export default function FilePreview({
  selected,
  context,
  onClose,
  onCopy,
}: {
  selected: S3File;
  context: SearchContext;
  onClose: () => void;
  onCopy: (uri: string) => void;
}) {
  const { info, text, detailError, detailLoading, setDetailError } =
    useFilePreview(selected, context);
  function fileUrl(inline = false) {
    return `/api/file?${new URLSearchParams({ connection: context.connection, query: selected.uri, ...(inline ? { inline: "1" } : {}) })}`;
  }

  return (
    <aside className="detail-card" aria-label="Просмотр файла">
      <div className="detail-heading">
        <span>ПРОСМОТР ФАЙЛА</span>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Закрыть просмотр"
        >
          <X size={18} />
        </button>
      </div>
      <div className="detail-title">
        <span className="file-icon">
          <FileIcon name={selected.key} />
        </span>
        <h2>{selected.key.split("/").pop()}</h2>
      </div>
      <div className="detail-actions">
        <a className="primary-button" href={fileUrl()} download>
          <ArrowDownToLine size={16} /> Скачать
        </a>
        <button
          className="secondary-button"
          onClick={() => onCopy(selected.uri)}
        >
          <Copy size={15} /> Адрес
        </button>
      </div>
      {detailError && (
        <div className="detail-error" role="alert">
          {detailError}
        </div>
      )}
      {info?.warning && (
        <div className="file-warning">
          <AlertTriangle size={19} />
          <div>
            <strong>Проверьте содержимое</strong>
            <p>{info.warning}</p>
          </div>
        </div>
      )}
      {detailLoading ? (
        <div className="preview-loading">
          <LoaderCircle size={24} className="spin" />
          <span>Проверяем файл…</span>
        </div>
      ) : (
        info && (
          <>
            <div className="preview-area">
              {info.preview === "image" ? (
                <img
                  src={fileUrl(true)}
                  alt={`Просмотр ${selected.key}`}
                  onError={() =>
                    setDetailError(
                      "Не удалось загрузить изображение. Попробуйте скачать файл.",
                    )
                  }
                />
              ) : info.preview === "pdf" ? (
                <iframe src={fileUrl(true)} title={`PDF ${selected.key}`} />
              ) : info.preview === "text" && text ? (
                <>
                  <div className="text-preview-label">
                    <FileText size={13} />
                    {info.actualType === "text/html"
                      ? "HTML · показан как текст"
                      : "Текстовое содержимое"}
                  </div>
                  <pre>{text.text}</pre>
                  {text.truncated && (
                    <p className="preview-truncated">
                      Показаны первые 256 КиБ. Скачайте файл для полного
                      просмотра.
                    </p>
                  )}
                </>
              ) : (
                <div className="unsupported-preview">
                  <File size={32} />
                  <p>Для этого формата доступно скачивание.</p>
                </div>
              )}
            </div>
            <dl className="file-metadata">
              <div>
                <dt>Размер</dt>
                <dd>{size(info.size)}</dd>
              </div>
              <div>
                <dt>Изменён · МСК</dt>
                <dd>{date(info.modified)}</dd>
              </div>
              <div>
                <dt>Тип в S3</dt>
                <dd>{info.contentType}</dd>
              </div>
              {info.actualType && (
                <div>
                  <dt>По содержимому</dt>
                  <dd className={info.warning ? "warning-value" : ""}>
                    {info.actualType}
                  </dd>
                </div>
              )}
            </dl>
          </>
        )
      )}
    </aside>
  );
}
