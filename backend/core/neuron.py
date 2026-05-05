from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class Neuron:
    name: str
    display_name: str
    description: str
    system_prompt: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 500

    @classmethod
    def from_yaml(cls, path: Path) -> "Neuron":
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls(**data)


def load_neurons(neurons_dir: Path) -> dict[str, Neuron]:
    neurons: dict[str, Neuron] = {}
    if not neurons_dir.exists():
        return neurons
    for config_path in neurons_dir.rglob("config.yaml"):
        neuron = Neuron.from_yaml(config_path)
        neurons[neuron.name] = neuron
    return neurons
