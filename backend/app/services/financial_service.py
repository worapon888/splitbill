"""Domain calculations for monetary allocation, satang rounding, and balances."""

from decimal import Decimal

from app.core.exceptions import InvalidSplitException


def calculate_equal_split(
    total_amount: Decimal,
    members: list[str],
) -> list[tuple[str, Decimal]]:
    """Divide total_amount equally among members allocating remainder satang in order.

    Algorithm:
    1. Convert total amount to integer satang: total_satang = int(round(total_amount * 100))
    2. Base satang per member = total_satang // n
    3. Remainder satang = total_satang % n
    4. Distribute 1 extra satang to the first remainder_satang members in provided order.
    5. Convert satang back to 2-decimal Decimal values.
    """
    if not members:
        raise InvalidSplitException("Equal split requires at least one member.")

    total_satang = int(round(total_amount * Decimal("100")))
    n = len(members)
    base_satang = total_satang // n
    remainder_satang = total_satang % n

    result: list[tuple[str, Decimal]] = []
    for i, member in enumerate(members):
        member_satang = base_satang + (1 if i < remainder_satang else 0)
        share_dec = Decimal(member_satang) / Decimal("100")
        result.append((member, share_dec))

    # Verification: sum of shares must equal total_amount exactly
    sum_shares = sum((amt for _, amt in result), start=Decimal("0.00"))
    if sum_shares != total_amount:
        raise InvalidSplitException(
            f"Internal allocation error: sum of shares ({sum_shares}) != total ({total_amount})"
        )

    return result


def validate_exact_split(
    total_amount: Decimal,
    shares: dict[str, str],
) -> list[tuple[str, Decimal]]:
    """Validate exact shares match total_amount and are positive.

    Requirements:
    1. Non-empty shares.
    2. Every share > 0.00.
    3. Sum of shares must equal total_amount down to 0.01 satang.
    """
    if not shares:
        raise InvalidSplitException("Exact split requires at least one share.")

    parsed_shares: list[tuple[str, Decimal]] = []
    for username, amount_str in shares.items():
        try:
            amt = Decimal(amount_str)
        except Exception:
            raise InvalidSplitException(
                f"Invalid monetary share for '{username}': {amount_str}"
            ) from None

        if amt <= Decimal("0.00"):
            raise InvalidSplitException(f"Share amount for '{username}' must be greater than zero.")
        parsed_shares.append((username, amt))

    sum_shares = sum((amt for _, amt in parsed_shares), start=Decimal("0.00"))
    if sum_shares != total_amount:
        raise InvalidSplitException("The shares do not add up to the total")

    return parsed_shares
