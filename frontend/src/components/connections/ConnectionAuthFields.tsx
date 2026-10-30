import type {
  Connection,
  ConnectionFormValues,
  SetConnectionField,
} from "../../connections";

export default function ConnectionAuthFields({
  editing,
  form,
  field,
}: {
  editing: Connection | null;
  form: ConnectionFormValues;
  field: SetConnectionField;
}) {
  const savedKeys = editing?.authMode === "keys" && form.auth_mode === "keys";
  return (
    <div className="auth-section">
      <label className="manager-field">
        Способ авторизации
        <select
          value={form.auth_mode}
          onChange={(event) =>
            field("auth_mode", event.target.value as Connection["authMode"])
          }
        >
          <option value="keys">Ключи доступа</option>
          <option value="env">Переменные окружения</option>
          <option value="profile">AWS-профиль</option>
        </select>
      </label>
      {form.auth_mode === "keys" ? (
        <>
          <label className="manager-field">
            Access key ID
            <input
              type="password"
              autoComplete="new-password"
              value={form.access_key_id}
              onChange={(event) => field("access_key_id", event.target.value)}
              placeholder={
                savedKeys && editing?.hasAccessKey
                  ? "Сохранён · оставьте пустым, чтобы не менять"
                  : "Access key ID"
              }
              required={!savedKeys || !editing?.hasAccessKey}
            />
          </label>
          <label className="manager-field">
            Secret access key
            <input
              type="password"
              autoComplete="new-password"
              value={form.secret_access_key}
              onChange={(event) =>
                field("secret_access_key", event.target.value)
              }
              placeholder={
                savedKeys && editing?.hasSecretKey
                  ? "Сохранён · оставьте пустым, чтобы не менять"
                  : "Secret access key"
              }
              required={!savedKeys || !editing?.hasSecretKey}
            />
          </label>
          <label className="manager-field">
            Session token <span>для временных ключей</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.session_token}
              onChange={(event) => field("session_token", event.target.value)}
              placeholder={
                savedKeys && editing?.hasSessionToken
                  ? "Сохранён · оставьте пустым, чтобы не менять"
                  : "Необязательно"
              }
            />
          </label>
          {savedKeys && editing?.hasSessionToken && (
            <label className="manager-checkbox">
              <input
                type="checkbox"
                checked={form.clear_session_token}
                onChange={(event) =>
                  field("clear_session_token", event.target.checked)
                }
              />
              Удалить сохранённый session token
            </label>
          )}
          <p className="secret-note">
            После сохранения значения ключей не возвращаются в браузер. Пустые
            поля при редактировании сохраняют текущие значения.
          </p>
        </>
      ) : form.auth_mode === "env" ? (
        <label className="manager-field">
          Префикс переменных
          <input
            value={form.credentials_env}
            onChange={(event) => field("credentials_env", event.target.value)}
            required
            placeholder="AWS или SELECTEL"
          />
          <small>
            Например, AWS_ACCESS_KEY_ID и AWS_SECRET_ACCESS_KEY. Переменные
            должны быть доступны Python-процессу или контейнеру.
          </small>
        </label>
      ) : (
        <label className="manager-field">
          Имя AWS-профиля
          <input
            value={form.profile}
            onChange={(event) => field("profile", event.target.value)}
            required
            placeholder="work"
          />
          <small>
            Профиль должен быть доступен на сервере. Для Docker каталог .aws
            подключается отдельно.
          </small>
        </label>
      )}
    </div>
  );
}
