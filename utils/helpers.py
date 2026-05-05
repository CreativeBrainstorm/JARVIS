"""
JARVIS AI Agent — Helper Utilities
====================================
Shared utility functions used across modules.
"""

import asyncio
import time
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable


def utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def timestamp_str() -> str:
    """Get current timestamp as ISO string."""
    return utc_now().isoformat()


def truncate(text: str, max_length: int = 200, suffix: str = "...") -> str:
    """Truncate text to max_length, adding suffix if truncated."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def format_bytes(size_bytes: int) -> str:
    """Format bytes into human-readable string."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} PB"


def timer(func: Callable) -> Callable:
    """Decorator to measure function execution time."""
    if asyncio.iscoroutinefunction(func):
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            start = time.perf_counter()
            result = await func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            from loguru import logger
            logger.debug(f"{func.__name__} took {elapsed:.3f}s")
            return result
        return async_wrapper
    else:
        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            start = time.perf_counter()
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            from loguru import logger
            logger.debug(f"{func.__name__} took {elapsed:.3f}s")
            return result
        return sync_wrapper


def safe_json_parse(text: str) -> dict | list | None:
    """Safely parse JSON from text, returning None on failure."""
    import json
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
