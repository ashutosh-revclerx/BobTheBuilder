from __future__ import annotations

import unittest
from unittest.mock import patch

from app.llm.chat import run_chat


class AssistantChatTest(unittest.IsolatedAsyncioTestCase):
    async def test_run_chat_accepts_route_dict_payload(self) -> None:
        payload = {
            "message": "What does this dashboard show?",
            "generationPrompt": "Build a sales dashboard",
            "dashboardName": "Sales",
            "dashboardConfig": {
                "components": [],
                "queries": [],
                "canvasStyle": {"backgroundColor": "#ffffff"},
            },
            "conversationHistory": [],
        }

        with patch(
            "app.llm.chat._call_gemini_chat",
            return_value='{"response":"It summarizes sales.","suggestions":[]}',
        ):
            result = await run_chat(payload)

        self.assertTrue(result.success)
        self.assertEqual("It summarizes sales.", result.response)
        self.assertEqual([], result.suggestions)


if __name__ == "__main__":
    unittest.main()
