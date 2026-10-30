import { useEffect, useState } from "react";

export default function useClipboard() {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast("S3-адрес скопирован");
    } catch {
      setToast("Не удалось скопировать адрес");
    }
  }

  return { toast, copy };
}
