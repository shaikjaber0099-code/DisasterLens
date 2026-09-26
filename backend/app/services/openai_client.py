import os
import json
import base64
from typing import Dict, Any, Optional
from openai import OpenAI
from backend.app.config import settings

def get_openai_client() -> Optional[OpenAI]:
    api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")
    if not api_key or api_key.strip() == "":
        return None
    return OpenAI(api_key=api_key)

def classify_image_with_gpt4o(image_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[Dict[str, Any]]:
    """
    Calls OpenAI gpt-4o with multimodal vision capabilities to classify disaster conditions.
    Requests structured JSON:
    {condition: 'flooded'|'smoke'|'damaged_infrastructure'|'none', severity_0_to_1, confidence_0_to_1, rationale, detected_features}
    """
    client = get_openai_client()
    if not client:
        return None

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    system_prompt = (
        "You are an expert multimodal disaster intelligence vision analyst. "
        "Analyze this aerial, drone, satellite, or ground photograph for disaster damage, flooding, wildfire smoke, or structural destruction. "
        "You MUST respond ONLY with valid JSON strictly conforming to this schema:\n"
        "{\n"
        '  "condition": "flooded" | "smoke" | "damaged_infrastructure" | "none",\n'
        '  "severity_0_to_1": float between 0.0 and 1.0,\n'
        '  "confidence_0_to_1": float between 0.0 and 1.0,\n'
        '  "rationale": "Clear, concise objective description of visible evidence (water depth, smoke plume, structural collapse, charred vegetation, etc.)",\n'
        '  "detected_features": ["feature 1", "feature 2"]\n'
        "}\n"
        "Do not include markdown fences or any other text outside the JSON object."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Classify this disaster scene image and estimate severity, confidence, and visible evidence indicators."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=500
        )

        content = response.choices[0].message.content
        data = json.loads(content)
        data["model_used"] = "gpt-4o"
        return data
    except Exception as e:
        print(f"OpenAI gpt-4o API error: {e}")
        return None
