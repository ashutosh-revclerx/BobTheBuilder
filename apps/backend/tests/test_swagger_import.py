from __future__ import annotations

import unittest

from app.routes.resources import _spec_candidates, _unwrap_swagger_doc
from app.utils.swagger_parser import parse_swagger_doc


class SwaggerImportTest(unittest.TestCase):
    def test_parser_merges_path_and_operation_parameters(self) -> None:
        endpoints = parse_swagger_doc(
            {
                "openapi": "3.0.0",
                "paths": {
                    "/users/{id}": {
                        "parameters": [{"name": "id", "in": "path"}],
                        "get": {
                            "summary": "Get user",
                            "parameters": [{"name": "verbose", "in": "query"}],
                        },
                    }
                },
            }
        )

        self.assertEqual(1, len(endpoints))
        self.assertEqual("GET", endpoints[0]["method"])
        self.assertEqual(["id", "verbose"], [p["name"] for p in endpoints[0]["parameters"]])

    def test_unwraps_common_api_response_envelopes(self) -> None:
        doc = {"data": {"openapi": "3.0.0", "paths": {"/health": {"get": {}}}}}

        self.assertEqual(
            {"openapi": "3.0.0", "paths": {"/health": {"get": {}}}},
            _unwrap_swagger_doc(doc),
        )

    def test_candidates_include_docker_host_for_localhost(self) -> None:
        candidates = _spec_candidates("http://localhost:8080/swagger-ui/index.html")

        self.assertIn("http://host.docker.internal:8080/swagger-ui/index.html", candidates)
        self.assertIn("http://localhost:8080/v3/api-docs", candidates)


if __name__ == "__main__":
    unittest.main()
