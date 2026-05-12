from __future__ import annotations

import unittest

from app.routes.execute import (
    ExecuteSchema,
    _query_is_allowed,
    _template_matches,
    _upload_is_allowed,
)


class ExecutePublicScopeTest(unittest.TestCase):
    def test_template_match_allows_resolved_bindings(self) -> None:
        self.assertTrue(_template_matches("/jobs/{{queries.upload.data.id}}", "/jobs/abc123"))
        self.assertTrue(_template_matches("/status/{session_id}", "/status/session-1"))
        self.assertFalse(_template_matches("/jobs/{{id}}/detail", "/jobs/abc123/other"))

    def test_public_query_must_match_dashboard_config(self) -> None:
        config = {
            "queries": [
                {
                    "name": "loadOrders",
                    "resource": "orders-api",
                    "endpoint": "/orders/{{componentState.filter.value}}",
                    "method": "GET",
                }
            ]
        }

        allowed = ExecuteSchema(
            queryName="loadOrders",
            resource="orders-api",
            endpoint="/orders/open",
            method="GET",
        )
        denied = ExecuteSchema(
            queryName="loadOrders",
            resource="orders-api",
            endpoint="/admin/users",
            method="GET",
        )

        self.assertTrue(_query_is_allowed(config, allowed))
        self.assertFalse(_query_is_allowed(config, denied))

    def test_public_upload_must_match_file_upload_component(self) -> None:
        config = {
            "components": [
                {
                    "id": "uploader",
                    "type": "FileUpload",
                    "data": {
                        "resourceId": "resource-1",
                        "endpointPath": "/upload",
                    },
                }
            ]
        }

        self.assertTrue(
            _upload_is_allowed(
                config,
                resource_id="resource-1",
                resource_name="",
                endpoint_path="/upload",
            )
        )
        self.assertFalse(
            _upload_is_allowed(
                config,
                resource_id="resource-1",
                resource_name="",
                endpoint_path="/delete",
            )
        )


if __name__ == "__main__":
    unittest.main()
