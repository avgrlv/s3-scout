export type S3File = {
  kind: "file";
  key: string;
  size: number;
  modified: string;
  uri: string;
};
export type S3Folder = {
  kind: "folder";
  key: string;
  size: null;
  modified: null;
  uri: string;
};
export type S3Object = S3File | S3Folder;
export type FileInfo = S3File & {
  contentType: string;
  actualType: string | null;
  preview: "pdf" | "image" | "text" | "unsupported";
  warning: string | null;
};
export type Listing = {
  items: S3Object[];
  cursor: string | null;
  bucket: string;
  prefix: string;
};
export type BrowseMode = "folders" | "files";
export type SearchContext = {
  connection: string;
  query: string;
  limit: string;
  mode: BrowseMode;
};

export type BrowsePath = { bucket: string; prefix: string };
export type TextPreview = { text: string; truncated: boolean };
