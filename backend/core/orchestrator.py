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

    async def process(self, history: list[dict]) -> str:
        """Process the conversation history and return the assistant reply.

        `history` is a list of {"role": "user"|"assistant", "content": str}
        with the full conversation so far (oldest first).
        """
        if not self.neurons:
            return "No hay neuronas configuradas. Añade al menos una en backend/neurons/."
        neuron = next(iter(self.neurons.values()))
        return await self._invoke_neuron(neuron, history)

    async def _invoke_neuron(self, neuron: Neuron, history: list[dict]) -> str:
        messages = [{"role": "system", "content": neuron.system_prompt}, *history]
        response = await self.client.chat.completions.create(
            model=neuron.model,
            temperature=neuron.temperature,
            max_tokens=neuron.max_tokens,
            messages=messages,
        )
        return response.choices[0].message.content or ""
