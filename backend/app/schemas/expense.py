"""Pydantic v2 schemas for expenses, splits, and shares."""

import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MONEY_REGEX = re.compile(r"^[0-9]+(\.[0-9]{1,2})?$")


def validate_monetary_string(v: Any, allow_zero: bool = False) -> str:
    """Validate that a monetary value is a valid 2-decimal positive string."""
    if not isinstance(v, str):
        v = str(v)
    v = v.strip()
    if not MONEY_REGEX.match(v):
        raise ValueError(
            "Amount must be a valid positive monetary string with at most 2 decimal places."
        )
    dec = Decimal(v)
    if allow_zero:
        if dec < Decimal("0.00"):
            raise ValueError("Amount cannot be negative.")
    else:
        if dec <= Decimal("0.00"):
            raise ValueError("Amount must be greater than zero.")
    return f"{dec:.2f}"


class ExpenseShareItem(BaseModel):
    """Individual share item allocated to a member."""

    username: str
    amount: str

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        return validate_monetary_string(v, allow_zero=True)


class ExpenseSplit(BaseModel):
    """Split specification for dividing an expense among group members."""

    type: Literal["equal", "exact"]
    members: list[str] | None = None
    shares: dict[str, str] | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_and_validate(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        split_type = data.get("type")
        if split_type == "equal":
            members = data.get("members")
            if not members or not isinstance(members, list):
                raise ValueError("Equal split requires a non-empty 'members' list.")
            if len(members) != len(set(members)):
                raise ValueError("Equal split 'members' list cannot contain duplicate usernames.")
        elif split_type == "exact":
            shares = data.get("shares")
            if not shares:
                raise ValueError("Exact split requires 'shares'.")
            validated_shares: dict[str, str] = {}
            if isinstance(shares, list):
                for item in shares:
                    if not isinstance(item, dict):
                        raise ValueError("Each share in shares list must be an object.")
                    uname = item.get("username")
                    amt = item.get("amount")
                    if not uname:
                        raise ValueError("Each share must specify a username.")
                    if uname in validated_shares:
                        raise ValueError(f"Duplicate share for member: {uname}")
                    validated_shares[uname] = validate_monetary_string(amt, allow_zero=False)
            elif isinstance(shares, dict):
                for uname, amt in shares.items():
                    validated_shares[uname] = validate_monetary_string(amt, allow_zero=False)
            else:
                raise ValueError("Exact split 'shares' must be a dictionary or list of shares.")
            data["shares"] = validated_shares
        return data


class ExpenseCreate(BaseModel):
    """Request schema for recording a new expense."""

    description: str = Field(..., min_length=1, max_length=255)
    amount: str
    paid_by: str = Field(..., min_length=1)
    split: ExpenseSplit

    @field_validator("amount")
    @classmethod
    def validate_expense_amount(cls, v: str) -> str:
        return validate_monetary_string(v, allow_zero=False)


class ExpenseResponse(BaseModel):
    """Response schema representing a created or queried expense."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    paid_by: str
    description: str
    amount: str
    created_at: datetime
    shares: list[ExpenseShareItem]
