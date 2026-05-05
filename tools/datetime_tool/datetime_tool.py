"""
JARVIS AI Agent — DateTime Tool
==================================
Provides current date, time, and timezone information.
"""

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from tools.base import BaseTool, ToolParameter


class DateTimeTool(BaseTool):
    """Tool for getting current date and time information."""

    name = "get_datetime"
    description = (
        "Get the current date and time. Can return time in a specific timezone. "
        "Use this when the user asks about the current time, date, or day."
    )
    parameters = [
        ToolParameter(
            name="timezone",
            type="string",
            description="IANA timezone name (e.g., 'Europe/Madrid', 'America/New_York', 'UTC'). Defaults to local time.",
            required=False,
        ),
        ToolParameter(
            name="format",
            type="string",
            description="Output format: 'full' (date + time + day), 'date' (date only), 'time' (time only)",
            required=False,
            enum=["full", "date", "time"],
        ),
    ]
    category = "utility"

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        tz_name = kwargs.get("timezone", None)
        fmt = kwargs.get("format", "full")

        try:
            if tz_name:
                tz = ZoneInfo(tz_name)
            else:
                tz = None  # Local time

            now = datetime.now(tz or timezone.utc)
            if not tz_name:
                now = datetime.now()

            result: dict[str, Any] = {}

            if fmt in ("full", "date"):
                result["date"] = now.strftime("%Y-%m-%d")
                result["day_of_week"] = now.strftime("%A")

            if fmt in ("full", "time"):
                result["time"] = now.strftime("%H:%M:%S")

            result["timezone"] = tz_name or "local"
            result["iso"] = now.isoformat()
            result["unix_timestamp"] = int(now.timestamp())

            return {"result": result}

        except Exception as e:
            return {"error": str(e)}
