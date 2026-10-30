import { ChevronRight, Copy, Folder } from "lucide-react";
import type { S3Object } from "../../types/storage";
import { date, size } from "../../lib/format";
import FileIcon from "../FileIcon";

export default function ObjectTable({
  items,
  selectedUri,
  prefix,
  onOpen,
  onCopy,
}: {
  items: S3Object[];
  selectedUri: string | undefined;
  prefix: string;
  onOpen: (item: S3Object) => void;
  onCopy: (uri: string) => void;
}) {
  const directoryPrefix = prefix.endsWith("/")
    ? prefix
    : prefix.slice(0, prefix.lastIndexOf("/") + 1);
  function entryParent(item: S3Object) {
    const key = item.key.replace(/\/$/, "");
    const parent = key.slice(0, key.lastIndexOf("/") + 1);
    return parent.startsWith(directoryPrefix)
      ? parent.slice(directoryPrefix.length)
      : parent;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th className="size-column">Размер</th>
            <th className="date-column">Изменён · МСК</th>
            <th>
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.kind}:${item.uri}`}
              className={`${item.kind === "folder" ? "folder-row" : ""} ${selectedUri === item.uri ? "selected-row" : ""}`}
              onClick={() => onOpen(item)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onOpen(item);
                }
              }}
              aria-label={`Открыть ${item.kind === "folder" ? "папку " : ""}${item.key}`}
            >
              <td>
                <div className="file-cell">
                  <span
                    className={`file-icon ${item.kind === "folder" ? "folder-icon" : item.key.endsWith(".pdf") ? "pdf-icon" : ""}`}
                  >
                    {item.kind === "folder" ? (
                      <Folder size={20} />
                    ) : (
                      <FileIcon name={item.key} />
                    )}
                  </span>
                  <div>
                    <strong title={item.key}>
                      {item.key.replace(/\/$/, "").split("/").pop() || item.key}
                      {item.kind === "folder" ? "/" : ""}
                    </strong>
                    <small className="entry-location" title={item.key}>
                      {entryParent(item) ||
                        (item.kind === "folder"
                          ? "Вложенная папка"
                          : "В этой папке")}
                    </small>
                  </div>
                </div>
              </td>
              <td className="size-column">
                {item.kind === "folder" ? "Папка" : size(item.size)}
              </td>
              <td className="date-column">
                {item.modified ? date(item.modified) : "—"}
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="icon-button row-copy"
                    title="Скопировать S3-адрес"
                    aria-label={`Скопировать адрес ${item.key}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onCopy(item.uri);
                    }}
                  >
                    <Copy size={15} />
                  </button>
                  {item.kind === "folder" && (
                    <ChevronRight
                      size={16}
                      className="open-folder-arrow"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
