"""Parses Swagger 2.0 / OpenAPI 3.0 into normalised endpoint records."""
from typing import Any

HTTP_METHODS = {"get", "post", "put", "delete", "patch"}


def parse_swagger_doc(doc: Any) -> list[dict]:
    if not isinstance(doc, dict):
        return []
    paths = doc.get("paths")
    if not isinstance(paths, dict):
        return []

    endpoints: list[dict] = []
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method in HTTP_METHODS:
            op = path_item.get(method)
            if not isinstance(op, dict):
                continue
            endpoints.append(
                {
                    "method": method.upper(),
                    "path": path,
                    "summary": op.get("summary") or op.get("description") or None,
                    "parameters": op.get("parameters") if isinstance(op.get("parameters"), list) else [],
                    "request_body": op.get("requestBody") if isinstance(op.get("requestBody"), dict) else {},
                }
            )
    return endpoints
