"""
JARVIS AI Agent — Configuration Settings
==========================================
Central configuration using Pydantic Settings for type-safe,
validated configuration loaded from environment variables.
"""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Project root directory
PROJECT_ROOT = Path(__file__).parent.parent.resolve()


class JarvisSettings(BaseSettings):
    """Main configuration for JARVIS AI Agent."""

    model_config = SettingsConfigDict(
        env_prefix="JARVIS_",
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- LLM Provider ----
    llm_provider: Literal["openai", "anthropic", "gemini", "ollama"] = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    llm_max_tokens: int = Field(default=4096, ge=1)

    # ---- Server ----
    host: str = "0.0.0.0"
    port: int = Field(default=8000, ge=1, le=65535)
    debug: bool = True

    # ---- Memory ----
    chroma_path: str = "./data/chroma"
    sqlite_path: str = "./data/sqlite/jarvis.db"
    memory_window: int = Field(default=20, ge=1, description="Number of messages to keep in short-term memory")

    # ---- Voice ----
    wake_word: str = "jarvis"
    tts_voice: str = "en-US-GuyNeural"

    # ---- Logging ----
    log_level: str = "INFO"
    log_path: str = "./data/logs"

    # ---- Agent Identity ----
    agent_name: str = "JARVIS"
    agent_version: str = "0.1.0"

    @property
    def chroma_dir(self) -> Path:
        """Resolved ChromaDB storage path."""
        path = Path(self.chroma_path)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def sqlite_file(self) -> Path:
        """Resolved SQLite database path."""
        path = Path(self.sqlite_path)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def log_dir(self) -> Path:
        """Resolved log directory path."""
        path = Path(self.log_path)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def personality_prompt(self) -> str:
        """Load the personality system prompt."""
        prompt_file = PROJECT_ROOT / "config" / "prompts" / "jarvis_personality.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        return f"You are {self.agent_name}, a highly intelligent AI assistant."

    def get_litellm_model(self) -> str:
        """Get the model string formatted for LiteLLM."""
        if self.llm_provider == "ollama":
            return f"ollama/{self.llm_model}"
        elif self.llm_provider == "anthropic":
            return f"anthropic/{self.llm_model}"
        elif self.llm_provider == "gemini":
            return f"gemini/{self.llm_model}"
        return self.llm_model  # OpenAI format is default


# Singleton settings instance
settings = JarvisSettings()
