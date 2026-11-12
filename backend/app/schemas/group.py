"""Pydantic v2 schemas for groups and group details."""

from pydantic import BaseModel, ConfigDict


class GroupResponse(BaseModel):
    """Summary response schema for a group."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class GroupDetailResponse(BaseModel):
    """Detailed response schema for a group including member usernames."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    members: list[str]
