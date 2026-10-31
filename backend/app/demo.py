"""Public demo mode (e.g. Render free plan): small seed on start, capped size. Off unless RECALL_DEMO_SEED=1."""

import os

FLAG = "RECALL_DEMO_SEED"
MAX_RECALLS = 50
FULL_MESSAGE = "Demo is full. It resets when the server restarts."


def enabled() -> bool:
    return os.environ.get(FLAG) == "1"


class DemoFullError(Exception):
    """The demo database already holds MAX_RECALLS recalls."""
