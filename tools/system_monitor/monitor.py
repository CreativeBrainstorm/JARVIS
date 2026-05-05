"""
JARVIS AI Agent — System Monitor Tool
========================================
Provides real-time system information: CPU, memory,
disk usage, battery status, and network info.
"""

import platform
from typing import Any

import psutil

from tools.base import BaseTool, ToolParameter
from utils.helpers import format_bytes


class SystemMonitorTool(BaseTool):
    """Tool for monitoring system resources and health."""

    name = "system_monitor"
    description = (
        "Get current system information including CPU usage, memory (RAM), "
        "disk space, battery status, and basic system details. "
        "Use this when the user asks about system status, performance, or resources."
    )
    parameters = [
        ToolParameter(
            name="component",
            type="string",
            description="Which component to check: 'all', 'cpu', 'memory', 'disk', 'battery', 'system'",
            required=False,
            enum=["all", "cpu", "memory", "disk", "battery", "system"],
        ),
    ]
    category = "system"

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        component = kwargs.get("component", "all")
        result: dict[str, Any] = {}

        try:
            if component in ("all", "cpu"):
                result["cpu"] = {
                    "usage_percent": psutil.cpu_percent(interval=0.5),
                    "cores_physical": psutil.cpu_count(logical=False),
                    "cores_logical": psutil.cpu_count(logical=True),
                    "frequency_mhz": round(psutil.cpu_freq().current) if psutil.cpu_freq() else "N/A",
                }

            if component in ("all", "memory"):
                mem = psutil.virtual_memory()
                result["memory"] = {
                    "total": format_bytes(mem.total),
                    "used": format_bytes(mem.used),
                    "available": format_bytes(mem.available),
                    "usage_percent": mem.percent,
                }

            if component in ("all", "disk"):
                disk = psutil.disk_usage("/")
                result["disk"] = {
                    "total": format_bytes(disk.total),
                    "used": format_bytes(disk.used),
                    "free": format_bytes(disk.free),
                    "usage_percent": round(disk.percent, 1),
                }

            if component in ("all", "battery"):
                battery = psutil.sensors_battery()
                if battery:
                    result["battery"] = {
                        "percent": battery.percent,
                        "plugged_in": battery.power_plugged,
                        "time_left": (
                            f"{battery.secsleft // 3600}h {(battery.secsleft % 3600) // 60}m"
                            if battery.secsleft > 0
                            else "Charging" if battery.power_plugged else "Unknown"
                        ),
                    }
                else:
                    result["battery"] = {"status": "No battery detected (desktop)"}

            if component in ("all", "system"):
                result["system"] = {
                    "os": f"{platform.system()} {platform.release()}",
                    "architecture": platform.machine(),
                    "hostname": platform.node(),
                    "python_version": platform.python_version(),
                }

            return {"result": result}

        except Exception as e:
            return {"error": str(e)}
