from openai import AsyncOpenAI

from backend.core.neuron import Neuron


class Orchestrator:
    """Routes user messages to the right neuron.

    Sprint 1: only one neuron exists; always invoke it.
    Sprint 2+: tool-calling to pick the right one when multiple are available.
    """

    def __init__(self, openai_client: AsyncOpenAI, neurons: dict[str, Neuron]):
        self.client = openai_client
        self.neurons = neurons

    async def process(self, message: str) -> str:
        if not self.neurons:
            return "No hay neuronas configuradas. Añade al menos una en backend/neurons/."
        neuron = next(iter(self.neurons.values()))
        return await self._invoke_neuron(neuron, message)

    async def _invoke_neuron(self, neuron: Neuron, user_message: str) -> str:
        response = await self.client.chat.completions.create(
            model=neuron.model,
            temperature=neuron.temperature,
            max_tokens=neuron.max_tokens,
            messages=[
                {"role": "system", "content": neuron.system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
        return response.choices[0].message.content or ""
