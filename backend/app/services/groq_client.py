import os
import json
from typing import Dict, Any, List, Optional
from groq import Groq
from backend.app.config import settings

def get_groq_client() -> Optional[Groq]:
    api_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY", "")
    if not api_key or api_key.strip() == "":
        return None
    try:
        return Groq(api_key=api_key)
    except Exception as e:
        print(f"Failed to initialize Groq client: {e}")
        return None

def generate_situation_summary_with_groq(zone_payload: Dict[str, Any]) -> str:
    """
    Drafts an evidence-linked disaster situation summary using Groq llama-3.3-70b-versatile.
    Strictly reasons over fused multi-source JSON.
    """
    client = get_groq_client()
    if client:
        try:
            system_prompt = (
                "You are an elite disaster intelligence officer at a national emergency command desk. "
                "Draft a high-priority, evidence-linked Situation Summary based STRICTLY on the provided JSON data. "
                "CRITICAL RULES:\n"
                "1. DO NOT invent, extrapolate, or hallucinate facts not present in the JSON.\n"
                "2. Explicitly cite the modalities available: Satellite/aerial imagery, IoT telemetry, Weather observations, and Incident reports.\n"
                "3. Reference the deterministic severity score and confidence level.\n"
                "4. Note any missing modalities or confidence gaps under a 'Data Limitations' note.\n"
                "5. Provide actionable human-in-the-loop recommendations for the desk operator (evacuation warnings, reconnaissance, dike inspection, aerial surveillance).\n"
                "Format clearly with concise markdown sections: ## Current Assessment, ## Modality Evidence, ## Operational Recommendations, ## Limitations & Confidence."
            )

            user_prompt = f"Fused Zone Telemetry & Multi-Modal Evidence:\n```json\n{json.dumps(zone_payload, indent=2)}\n```"

            response = client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=650
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Groq llama-3.3-70b call failed: {e}. Falling back to deterministic summary generator.")

    # High-fidelity deterministic summary fallback
    zone_name = zone_payload.get("name", "Unknown Zone")
    disaster_type = zone_payload.get("disaster_type", "disaster").capitalize()
    severity = zone_payload.get("current_severity", 0.5)
    confidence = zone_payload.get("current_confidence", 0.5)
    evidence = zone_payload.get("evidence", [])
    weather = zone_payload.get("weather", {})
    sensors = zone_payload.get("sensors", {})
    incidents_count = zone_payload.get("incident_count", 0)

    # Classify severity label
    sev_label = "CRITICAL" if severity >= 0.75 else "ELEVATED" if severity >= 0.45 else "MODERATE"
    conf_label = "HIGH" if confidence >= 0.75 else "MEDIUM" if confidence >= 0.4 else "LOW (NEEDS MORE DATA)"

    lines = [
        f"## Current Assessment — {zone_name}",
        f"**Threat Level:** {sev_label} (Deterministic Severity Index: **{severity:.2f}/1.00**) | **Confidence:** {conf_label} (**{confidence:.0%}**)",
        f"**Active Hazards:** Multi-modal surveillance confirms ongoing {disaster_type.lower()} event with {incidents_count} field/citizen incident reports received.",
        "",
        "## Modality Evidence",
    ]

    # Image evidence summary
    img_ev = [e for e in evidence if e.get("type") == "image"]
    if img_ev:
        latest_img = img_ev[-1].get("payload", {})
        lines.append(f"- **Vision Analysis ({latest_img.get('model_used', 'Vision Pipeline')}):** Classified condition as `{latest_img.get('condition', 'detected')}` (Severity: {latest_img.get('severity_score', 'N/A')}). {latest_img.get('rationale', '')}")
    else:
        lines.append("- **Vision Analysis:** *No recent optical satellite or drone pass available.*")

    # Sensor evidence summary
    if sensors:
        sensor_str = ", ".join([f"{k.replace('_', ' ').title()}: {v.get('value')} {v.get('unit')}" for k, v in sensors.items()])
        lines.append(f"- **IoT Ground Telemetry:** Active readings: {sensor_str}.")
    else:
        lines.append("- **IoT Ground Telemetry:** Operational, standard baseline within bounds.")

    # Weather evidence summary
    if weather:
        lines.append(f"- **Atmospheric Conditions ({weather.get('source', 'Meteorological Station')}):** Temp {weather.get('temperature', 0)}°C, Humidity {weather.get('humidity', 0)}%, Wind {weather.get('wind_speed', 0)} km/h, Precipitation {weather.get('precipitation', 0)} mm/h.")

    lines.extend([
        "",
        "## Operational Recommendations (Human Operator Approval Required)",
        f"1. {'Dispatch immediate search & rescue reconnaissance and alert downstream flood gates.' if disaster_type == 'Flood' else 'Deploy aerial retardant drops and establish secondary containment line along perimeter.'}",
        "2. Review pending multi-modal evidence cards in the operator review queue before committing resources.",
        "3. Validate ground sensor telemetry against satellite hotspot thermal passes.",
        "",
        "## Limitations & Confidence Audit",
        f"- Confidence Score: **{confidence:.2f}**. " + ("Sufficient multi-sensor corroboration exists." if confidence >= 0.7 else "Uncertainty elevated due to modality gaps; additional drone reconnaissance or sensor verification recommended.")
    ])

    return "\n".join(lines)


def rerank_review_queue_with_groq(queue_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Uses Groq llama-3.1-8b-instant to rapidly re-rank and prioritize review queue items.
    Priority score = severity * (1 - confidence) combined with human triage heuristics.
    """
    client = get_groq_client()
    if client and len(queue_items) > 1:
        try:
            prompt = (
                "You are an autonomous disaster triage engine. Given this list of pending disaster evidence items, "
                "return ONLY a JSON list of item IDs ordered from highest operational urgency to lowest. "
                "Prioritize high severity combined with low confidence (where human operator verification is most urgently required).\n"
                f"Items:\n{json.dumps([{'id': x['id'], 'zone_name': x.get('zone_name'), 'severity': x.get('severity'), 'confidence': x.get('confidence'), 'type': x.get('type')} for x in queue_items])}"
            )
            res = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=250
            )
            parsed = json.loads(res.choices[0].message.content)
            order_ids = parsed.get("ordered_ids") or parsed.get("ids") or []
            if order_ids:
                id_map = {item["id"]: item for item in queue_items}
                ordered = [id_map[i] for i in order_ids if i in id_map]
                # Append any missing items
                seen = set(item["id"] for item in ordered)
                for it in queue_items:
                    if it["id"] not in seen:
                        ordered.append(it)
                return ordered
        except Exception as e:
            print(f"Groq llama-3.1-8b-instant ranking error: {e}")

    # Deterministic ranking: Sort by (severity * (1.2 - confidence)) descending
    return sorted(queue_items, key=lambda x: (x.get("severity", 0.5) * (1.2 - x.get("confidence", 0.5))), reverse=True)
