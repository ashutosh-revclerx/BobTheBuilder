from __future__ import annotations

import inspect
import unittest

from fastapi.routing import APIRoute

from app.main import app


class AppSmokeTest(unittest.TestCase):
    def test_expected_routes_are_registered(self) -> None:
        route_keys = {
            (next(iter(route.methods)), route.path)
            for route in app.routes
            if isinstance(route, APIRoute)
        }

        expected = {
            ("GET", "/health"),
            ("POST", "/api/v1/auth/login"),
            ("GET", "/api/v1/auth/me"),
            ("GET", "/api/v1/dashboards"),
            ("POST", "/api/v1/dashboards/generate"),
            ("GET", "/api/v1/resources"),
            ("POST", "/api/v1/resources/import-swagger"),
            ("GET", "/api/v1/customers"),
            ("GET", "/api/v1/customers/{slug}/dashboard"),
            ("POST", "/api/v1/execute"),
            ("POST", "/api/v1/assistant/chat"),
        }

        self.assertTrue(expected.issubset(route_keys))

    def test_all_api_route_handlers_are_async(self) -> None:
        sync_routes = [
            route.path
            for route in app.routes
            if isinstance(route, APIRoute)
            and route.path.startswith("/api/")
            and not inspect.iscoroutinefunction(route.endpoint)
        ]

        self.assertEqual([], sync_routes)


if __name__ == "__main__":
    unittest.main()
