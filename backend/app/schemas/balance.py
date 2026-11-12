"""Pydantic v2 schemas for group member balances."""

from pydantic import BaseModel, ConfigDict


class BalanceResponse(BaseModel):
    """Net balance representation for a member in a group."""

    model_config = ConfigDict(from_attributes=True)

    username: str
    balance: str
