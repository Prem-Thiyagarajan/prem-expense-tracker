# File: app/core/validators.py
"""Shared input validators so one policy is enforced at every entry point."""
import re


def validate_password_strength(v: str) -> str:
    """Raise ValueError if the password fails complexity rules; else return it."""
    if len(v) < 8:
        raise ValueError('Password must be at least 8 characters long')
    if not re.search(r'[A-Z]', v):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', v):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'[0-9]', v):
        raise ValueError('Password must contain at least one number')
    if not re.search(r'[\W_]', v):
        raise ValueError('Password must contain at least one special character')
    return v


if __name__ == "__main__":
    # self-check: run with `python -m app.core.validators`
    good = "Abcdefg1!"
    assert validate_password_strength(good) == good
    for bad in ["Ab1!", "abcdefg1!", "ABCDEFG1!", "Abcdefgh!", "Abcdefg1"]:
        try:
            validate_password_strength(bad)
            raise AssertionError(f"should have rejected: {bad}")
        except ValueError:
            pass
    print("validators self-check OK")
