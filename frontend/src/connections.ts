export type Connection = {
  id: string;
  label: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
  configured: boolean;
  credentialsSource: string;
  authMode: "keys" | "env" | "profile";
  credentialsEnv: string;
  profile: string;
  caBundle: string;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  hasSessionToken: boolean;
};

export type ConnectionList = {
  connections: Connection[];
  default: string | null;
};

export type ConnectionFormValues = {
  label: string;
  endpoint_url: string;
  region: string;
  bucket: string;
  prefix: string;
  auth_mode: Connection["authMode"];
  credentials_env: string;
  profile: string;
  access_key_id: string;
  secret_access_key: string;
  session_token: string;
  ca_bundle: string;
  is_default: boolean;
  clear_session_token: boolean;
};

export type SetConnectionField = <K extends keyof ConnectionFormValues>(
  name: K,
  value: ConnectionFormValues[K],
) => void;
