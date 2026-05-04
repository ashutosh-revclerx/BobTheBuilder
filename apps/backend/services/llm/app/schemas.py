"""
Pydantic models that mirror the dashboard JSON schema the Node platform consumes.

These serve two purposes:
  1. Inbound validation of the request from Node (resources + prompt + count).
  2. Outbound validation of whatever Gemini returns — we reject (and retry once
     with the validator's error) any config that doesn't parse.

If you change anything here, also update the system prompt in `prompts.py` so
the LLM is told about the new shape.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


# ─── Inbound: what Node sends us ────────────────────────────────────────────


class ResourceEndpoint(BaseModel):
    method: str
    path: str
    summary: str | None = None


class ResourceContext(BaseModel):
    """A registered resource the LLM is allowed to reference in queries."""
    id: str
    name: str
    type: Literal["REST", "agent", "postgresql"]
    base_url: str | None = None
    endpoints: list[ResourceEndpoint] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3)
    resources: list[ResourceContext] = Field(default_factory=list)
    docs_urls: list[str] = Field(default_factory=list, alias="docsUrls")
    variant_count: int = Field(default=4, ge=1, le=8, alias="variantCount")

    model_config = {"populate_by_name": True}


# ─── Outbound: what Gemini must return (and what we hand back to Node) ──────


class ComponentLayout(BaseModel):
    x: int
    y: int
    w: int
    h: int


class DashboardComponent(BaseModel):
    id: str
    type: str
    label: str = ""
    layout: ComponentLayout
    style: dict[str, Any] = Field(default_factory=dict)
    data: dict[str, Any] = Field(default_factory=dict)


class DashboardQuery(BaseModel):
    name: str
    resource: str
    endpoint: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] = "GET"
    trigger: Literal["onLoad", "manual", "onDependencyChange"] = "onLoad"
    params: dict[str, Any] = Field(default_factory=dict)
    body: dict[str, Any] | None = None
    depends_on: list[str] = Field(default_factory=list, alias="dependsOn")

    model_config = {"populate_by_name": True}


class CanvasStyle(BaseModel):
    backgroundColor: str = "#f3f4f6"
    backgroundGradient: dict[str, Any] | None = None


class DashboardConfig(BaseModel):
    components: list[DashboardComponent]
    queries: list[DashboardQuery]
    canvasStyle: CanvasStyle | None = None


class GeneratedVariant(BaseModel):
    """One candidate dashboard. The user picks one of these in the UI."""
    name: str
    philosophy: str | None = None
    config: DashboardConfig


class GenerateResponse(BaseModel):
    success: bool
    configs: list[GeneratedVariant] = Field(default_factory=list)
    error: str | None = None
