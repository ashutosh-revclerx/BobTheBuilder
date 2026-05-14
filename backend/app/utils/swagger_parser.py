"""Swagger / OpenAPI parser — port of `src/utils/swaggerParser.ts`.

Parses Swagger 2.0 OR OpenAPI 3.0 docs into a normalised list of endpoint
records matching the resource_endpoints table shape.
"""

from __future__ import annotations

from typing import Any, TypedDict

HTTP_METHODS = ("get", "post", "put", "delete", "patch")


class ParsedEndpoint(TypedDict):
    method: str
    path: str
    summary: str | None
    parameters: list[Any]
    requestBody: dict[str, Any]


def parse_swagger_doc(doc: Any) -> list[ParsedEndpoint]:
    if not isinstance(doc, dict):
        return []
    paths = doc.get("paths")
    if not isinstance(paths, dict):
        return []

    endpoints: list[ParsedEndpoint] = []

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        path_params = path_item.get("parameters")
        path_params = path_params if isinstance(path_params, list) else []
        for method in HTTP_METHODS:
            op = path_item.get(method)
            if not isinstance(op, dict):
                continue

            params = op.get("parameters")
            req_body = op.get("requestBody")
            endpoints.append(
                {
                    "method": method.upper(),
                    "path": path,
                    "summary": op.get("summary") or op.get("description") or None,
                    "parameters": [
                        *path_params,
                        *(params if isinstance(params, list) else []),
                    ],
                    "requestBody": req_body if isinstance(req_body, dict) else {},
                }
            )

    return endpoints
