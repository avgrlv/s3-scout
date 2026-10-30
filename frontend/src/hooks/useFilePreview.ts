import { useEffect, useState } from "react";
import type {
  FileInfo,
  S3File,
  SearchContext,
  TextPreview,
} from "../types/storage";
import { api } from "../lib/api";

export default function useFilePreview(
  selected: S3File,
  context: SearchContext,
) {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [text, setText] = useState<TextPreview | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    setInfo(null);
    setText(null);
    setDetailError("");
    const controller = new AbortController();
    setDetailLoading(true);
    const params = { connection: context.connection, query: selected.uri };
    api<FileInfo>("object", params, controller.signal)
      .then(async (data) => {
        if (controller.signal.aborted) return;
        setInfo(data);
        if (data.preview === "text") {
          const preview = await api<TextPreview>(
            "text",
            params,
            controller.signal,
          );
          if (!controller.signal.aborted) setText(preview);
        }
      })
      .catch((error) => {
        if (error.name !== "AbortError") setDetailError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected, context]);

  return { info, text, detailError, detailLoading, setDetailError };
}
