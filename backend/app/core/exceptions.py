"""Domain exceptions for SplitBill business rules and access control."""

from typing import Any


class SplitBillException(Exception):
    """Base exception for all SplitBill domain errors."""

    def __init__(self, message: str, status_code: int = 400, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


class UserNotFoundException(SplitBillException):
    """Raised when the requesting user (X-User) does not exist."""

    def __init__(self, message: str = "User not found") -> None:
        super().__init__(message=message, status_code=401)


class GroupNotFoundException(SplitBillException):
    """Raised when a group ID does not exist."""

    def __init__(self, message: str = "Group not found") -> None:
        super().__init__(message=message, status_code=404)


class NotGroupMemberException(SplitBillException):
    """Raised when a user is not an active member of the target group."""

    def __init__(self, message: str = "Not a member of this group") -> None:
        super().__init__(message=message, status_code=403)


class ExpenseNotFoundException(SplitBillException):
    """Raised when an expense is not found or has already been deleted."""

    def __init__(self, message: str = "Expense not found") -> None:
        super().__init__(message=message, status_code=404)


class UnauthorizedPayerException(SplitBillException):
    """Raised when a non-payer attempts to delete an expense."""

    def __init__(self, message: str = "Only the payer can delete this expense") -> None:
        super().__init__(message=message, status_code=403)


class InvalidPayerException(SplitBillException):
    """Raised when the specified payer is not a member of the group."""

    def __init__(self, message: str = "Payer is not a member of this group") -> None:
        super().__init__(message=message, status_code=400)


class InvalidSplitException(SplitBillException):
    """Raised when an expense split specification fails business rules."""

    def __init__(self, message: str = "The shares do not add up to the total") -> None:
        super().__init__(message=message, status_code=400)


class IdempotencyConflictException(SplitBillException):
    """Raised when an idempotency key is reused with a different request payload."""

    def __init__(
        self,
        message: str = "Idempotency key reused with different request payload",
    ) -> None:
        super().__init__(message=message, status_code=409)
