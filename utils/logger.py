"""
JARVIS AI Agent — Logging Configuration
=========================================
Structured logging with Loguru, including file rotation,
colored console output, and JSON formatting for production.
"""

import sys
from pathlib import Path

from loguru import logger


def setup_logger(log_level: str = "INFO", log_dir: Path | None = None) -> None:
    """
    Configure Loguru logger for JARVIS.

    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR)
        log_dir: Directory for log files. If None, only console logging.
    """
    # Remove default handler
    logger.remove()

    # Console handler with rich formatting
    log_format = (
        "<cyan>{time:HH:mm:ss}</cyan> | "
        "<level>{level: <8}</level> | "
        "<magenta>{name}</magenta>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )

    logger.add(
        sys.stderr,
        format=log_format,
        level=log_level,
        colorize=True,
        backtrace=True,
        diagnose=True,
    )

    # File handlers
    if log_dir:
        log_dir = Path(log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)

        # General log file with rotation
        logger.add(
            str(log_dir / "jarvis_{time:YYYY-MM-DD}.log"),
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
            level=log_level,
            rotation="10 MB",
            retention="30 days",
            compression="zip",
            encoding="utf-8",
        )

        # Error-only log file
        logger.add(
            str(log_dir / "jarvis_errors_{time:YYYY-MM-DD}.log"),
            format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}\n{exception}",
            level="ERROR",
            rotation="5 MB",
            retention="60 days",
            compression="zip",
            encoding="utf-8",
        )

    logger.info("🤖 JARVIS Logger initialized | Level: {}", log_level)


def get_logger(name: str):
    """Get a contextualized logger for a specific module."""
    return logger.bind(module=name)
