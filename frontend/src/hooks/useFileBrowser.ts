import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Connection, ConnectionList } from "../connections";
import type {
  BrowseMode,
  BrowsePath,
  Listing,
  S3File,
  S3Object,
  SearchContext,
} from "../types/storage";
import { api } from "../lib/api";

export default function useFileBrowser() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [defaultConnection, setDefaultConnection] = useState<string | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionsReady, setConnectionsReady] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("100");
  const [mode, setMode] = useState<BrowseMode>("folders");
  const [items, setItems] = useState<S3Object[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [context, setContext] = useState<SearchContext | null>(null);
  const [browsePath, setBrowsePath] = useState<BrowsePath | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<S3File | null>(null);
  const listAbort = useRef<AbortController | null>(null);
  const connection = connections.find((item) => item.id === connectionId);

  useEffect(() => {
    const controller = new AbortController();
    api<ConnectionList>("connections", {}, controller.signal)
      .then((data) => {
        setConnections(data.connections);
        setDefaultConnection(data.default);
        const initial = data.connections.find(
          (item) => item.id === data.default,
        );
        setConnectionId(initial?.id || "");
        setQuery(initial?.prefix || "");
        setSettingsOpen(!initial);
        setConnectionsReady(true);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setError(error.message);
      });
    return () => {
      controller.abort();
      listAbort.current?.abort();
    };
  }, []);

  function changeConnection(next: Connection) {
    listAbort.current?.abort();
    setConnectionId(next.id);
    setQuery(next.prefix);
    setItems([]);
    setCursor(null);
    setContext(null);
    setBrowsePath(null);
    setSearched(false);
    setSelected(null);
    setError("");
    setLoading(false);
  }

  async function refreshConnections(preferred?: string) {
    const data = await api<ConnectionList>("connections");
    setConnections(data.connections);
    setDefaultConnection(data.default);
    const next =
      data.connections.find((item) => item.id === preferred) ||
      data.connections.find((item) => item.id === connectionId) ||
      data.connections.find((item) => item.id === data.default) ||
      data.connections[0];
    if (next) changeConnection(next);
    else {
      listAbort.current?.abort();
      setConnectionId("");
      setQuery("");
      setItems([]);
      setCursor(null);
      setContext(null);
      setBrowsePath(null);
      setSelected(null);
      setSearched(false);
      setLoading(false);
    }
  }

  async function search(
    event?: FormEvent,
    more = false,
    overrides: Partial<SearchContext> = {},
  ) {
    event?.preventDefault();
    if (!connection) return;
    const nextContext =
      more && context
        ? context
        : {
            connection: connectionId,
            query: query.trim(),
            limit,
            mode,
            ...overrides,
          };
    listAbort.current?.abort();
    const controller = new AbortController();
    listAbort.current = controller;
    setLoading(true);
    setError("");
    if (!more) {
      setItems([]);
      setSelected(null);
      setContext(nextContext);
      setCursor(null);
      setSearched(false);
    }
    try {
      const data = await api<Listing>(
        "objects",
        { ...nextContext, ...(more && cursor ? { cursor } : {}) },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setItems((previous) =>
        more ? [...previous, ...data.items] : data.items,
      );
      setCursor(data.cursor);
      setBrowsePath({ bucket: data.bucket, prefix: data.prefix });
      setSearched(true);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setError(error.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function navigate(uri: string) {
    const root = `s3://${connection?.bucket}/`;
    setQuery(uri.startsWith(root) ? uri.slice(root.length) : uri);
    setMode("folders");
    void search(undefined, false, { query: uri, mode: "folders" });
  }

  function openItem(item: S3Object) {
    if (item.kind === "folder") navigate(item.uri);
    else setSelected(item);
  }

  function changeMode(value: BrowseMode) {
    setMode(value);
    if (searched && connection?.configured)
      void search(undefined, false, { mode: value });
  }

  return {
    connections,
    connectionId,
    connection,
    defaultConnection,
    connectionsReady,
    settingsOpen,
    setSettingsOpen,
    refreshConnections,
    changeConnection,
    query,
    setQuery,
    limit,
    setLimit,
    mode,
    changeMode,
    items,
    cursor,
    context,
    browsePath,
    searched,
    loading,
    error,
    setError,
    selected,
    setSelected,
    search,
    navigate,
    openItem,
  };
}
