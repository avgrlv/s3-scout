import { File, FileImage, FileText } from "lucide-react";

export default function FileIcon({ name }: { name: string }) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension || ""))
    return <FileImage size={20} />;
  if (extension === "pdf") return <FileText size={20} />;
  return <File size={20} />;
}
