import httpx
import json
from typing import Optional


class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
    
    async def is_running(self) -> bool:
        """Check if Ollama is running."""
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.base_url}/api/tags", timeout=5)
                return r.status_code == 200
        except:
            return False
    
    async def get_models(self) -> list[str]:
        """Get available models."""
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{self.base_url}/api/tags", timeout=5)
                if r.status_code == 200:
                    data = r.json()
                    return [m["name"] for m in data.get("models", [])]
        except:
            return []
    
    async def generate(self, prompt: str, model: str = "llama3.2:3b", system: str = None) -> str:
        """Generate response from model."""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        if system:
            payload["system"] = system
        
        try:
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                    timeout=30
                )
                if r.status_code == 200:
                    return r.json().get("response", "")
        except:
            pass
        return ""
    
    async def classify_intent(self, message: str) -> dict:
        """Classify message intent using LLM."""
        system_prompt = """You are a dental clinic assistant. Classify the incoming WhatsApp message.

Return JSON with:
- intent: "confirm_appointment" | "cancel_appointment" | "reschedule" | "emergency" | "question" | "payment" | "general"
- urgency: 1-5 (1=low, 5=emergency)
- sentiment: "positive" | "neutral" | "negative"
- summary: brief summary of the message
- suggested_response: a short suggested response"""

        result = await self.generate(message, system=system_prompt)
        
        try:
            parsed = json.loads(result)
            return {
                "intent": parsed.get("intent", "general"),
                "urgency": parsed.get("urgency", 3),
                "sentiment": parsed.get("sentiment", "neutral"),
                "summary": parsed.get("summary", ""),
                "suggested_response": parsed.get("suggested_response", "")
            }
        except:
            return {
                "intent": "general",
                "urgency": 3,
                "sentiment": "neutral",
                "summary": result[:200] if result else "",
                "suggested_response": ""
            }
