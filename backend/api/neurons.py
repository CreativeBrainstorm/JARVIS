from fastapi import APIRouter, Request

neurons_router = APIRouter()


@neurons_router.get("/neurons")
async def list_neurons(request: Request) -> dict:
    orchestrator = request.app.state.orchestrator
    return {
        "neurons": [
            {
                "name": n.name,
                "display_name": n.display_name,
                "description": n.description.strip(),
            }
            for n in orchestrator.neurons.values()
        ]
    }
