"""Операции S3 для веб-интерфейса."""

from backend.cli import parse_s3_url


def location(connection, value, allow_empty=True):
    value = value.strip()
    if "://" in value:
        return parse_s3_url(value, connection.endpoint_url, allow_empty_key=allow_empty)
    if value == connection.bucket:
        value = ""
    elif value.startswith(connection.bucket + "/"):
        value = value[len(connection.bucket) + 1:]
    if not value and not allow_empty:
        raise ValueError("Укажи ключ файла или полный S3-адрес.")
    return connection.bucket, value


def list_files(client, bucket, prefix, limit=100, cursor=None, folders=True):
    arguments = {"Bucket": bucket, "Prefix": prefix, "MaxKeys": limit}
    if folders:
        arguments["Delimiter"] = "/"
    if cursor:
        arguments["ContinuationToken"] = cursor
    result = client.list_objects_v2(**arguments)
    items = [
        {
            "kind": "folder", "key": item["Prefix"], "size": None, "modified": None,
            "uri": f"s3://{bucket}/{item['Prefix']}",
        }
        for item in result.get("CommonPrefixes", [])
    ]
    items.extend(
            {
                "kind": "file", "key": item["Key"], "size": item["Size"],
                "modified": item["LastModified"].isoformat(),
                "uri": f"s3://{bucket}/{item['Key']}",
            }
            for item in result.get("Contents", [])
            if not (folders and item["Key"] == prefix and prefix.endswith("/"))
    )
    return {
        "bucket": bucket, "prefix": prefix, "items": items,
        "cursor": result.get("NextContinuationToken"),
    }


def sniff_type(data):
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        return "text/html"
    return None


def inspect_file(client, bucket, key):
    result = client.head_object(Bucket=bucket, Key=key)
    prefix = b""
    if result["ContentLength"]:
        response = client.get_object(Bucket=bucket, Key=key, Range="bytes=0-1023")
        with response["Body"] as stream:
            prefix = stream.read(1024)
    actual_type = sniff_type(prefix)
    declared_type = result.get("ContentType", "application/octet-stream")
    warning = None
    if actual_type == "text/html":
        warning = "Внутри файла HTML. Возможно, вместо документа сохранён ответ с ошибкой или перенаправлением."
    elif key.lower().endswith(".pdf") and actual_type != "application/pdf":
        warning = "У файла расширение PDF, но сигнатура PDF не обнаружена. Проверь содержимое."
    preview = "unsupported"
    if actual_type == "application/pdf":
        preview = "pdf"
    elif actual_type and actual_type.startswith("image/"):
        preview = "image"
    elif actual_type == "text/html" or declared_type.startswith("text/") or declared_type in ("application/json", "application/xml"):
        preview = "text"
    return {
        "kind": "file", "key": key, "uri": f"s3://{bucket}/{key}", "size": result["ContentLength"],
        "modified": result["LastModified"].isoformat(), "contentType": declared_type,
        "actualType": actual_type, "preview": preview, "warning": warning,
    }
