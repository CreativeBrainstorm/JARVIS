from openai import AsyncOpenAI

from backend.core.neuron import Neuron

ROUTER_SYSTEM_PROMPT = """Eres el orquestador del sistema JARVIS. Tu única tarea es
decidir qué neurona debe atender la petición del usuario, basándote en la
conversación actual y en las descripciones de las neuronas disponibles.

Cada neurona es un módulo especializado. Llama SIEMPRE exactamente una tool
(= neurona). No respondas al usuario directamente: solo elige la neurona."""

ROUTER_MODEL = "gpt-4o-mini"


class Orchestrator:
    """Routes user messages to the right neuron.

    With a single neuron: invokes it directly (saves a router call).
    With multiple neurons: a lightweight router LLM picks one via tool-calling,
    then the chosen neuron is invoked with the full conversation history.
    """

    def __init__(self, openai_client: AsyncOpenAI, neurons: dict[str, Neuron]):
        self.client = openai_client
        self.neurons = neurons

    async def process(self, history: list[dict]) -> tuple[str, str]:
        """Return (neuron_name, response_text)."""
        if not self.neurons:
            return ("none", "No hay neuronas configuradas. Añade al menos una en backend/neurons/.")
        if len(self.neurons) == 1:
            neuron = next(iter(self.neurons.values()))
            return (neuron.name, await self._invoke_neuron(neuron, history))
        neuron_name = await self._route(history)
        neuron = self.neurons[neuron_name]
        return (neuron_name, await self._invoke_neuron(neuron, history))

    async def _route(self, history: list[dict]) -> str:
        tools = [
            {
                "type": "function",
                "function": {
                    "name": neuron.name,
                    "description": neuron.description,
                    "parameters": {"type": "object", "properties": {}},
                },
            }
            for neuron in self.neurons.values()
        ]
        response = await self.client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=[{"role": "system", "content": ROUTER_SYSTEM_PROMPT}, *history],
            tools=tools,
            tool_choice="required",
        )
        tool_calls = response.choices[0].message.tool_calls
        if not tool_calls:
            return next(iter(self.neurons.keys()))
        return tool_calls[0].function.name

    async def _invoke_neuron(self, neuron: Neuron, history: list[dict]) -> str:
        messages = [{"role": "system", "content": neuron.system_prompt}, *history]
        response = await self.client.chat.completions.create(
            model=neuron.model,
            temperature=neuron.temperature,
            max_tokens=neuron.max_tokens,
            messages=messages,
        )
        return response.choices[0].message.content or ""
