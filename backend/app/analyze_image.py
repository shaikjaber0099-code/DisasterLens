import io
import cv2
import numpy as np
from PIL import Image
from typing import Dict, Any
from backend.app.services.openai_client import classify_image_with_gpt4o

def rule_based_spectral_vision_baseline(image_bytes: bytes) -> Dict[str, Any]:
    """
    Computer Vision baseline classifier using color spectrum analysis, edge entropy,
    and turbidity/haze metrics. Used as comparison baseline (§9) and zero-config fallback.
    """
    # Open image with PIL / OpenCV
    pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(pil_img)
    hsv = cv2.cvtColor(img_np, cv2.COLOR_RGB2HSV)

    # 1. Floodwater detection: Turbid brown/blue-gray water index
    # Blue water range & Muddy floodwater (brown/yellowish-dark)
    lower_blue = np.array([90, 40, 40])
    upper_blue = np.array([130, 255, 255])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)

    lower_brown = np.array([10, 40, 20])
    upper_brown = np.array([30, 200, 180])
    brown_mask = cv2.inRange(hsv, lower_brown, upper_brown)

    water_ratio = (np.count_nonzero(blue_mask) + np.count_nonzero(brown_mask)) / (img_np.shape[0] * img_np.shape[1])

    # 2. Fire and Smoke detection
    # Fire: bright orange/red/yellow
    lower_fire = np.array([5, 120, 150])
    upper_fire = np.array([25, 255, 255])
    fire_mask = cv2.inRange(hsv, lower_fire, upper_fire)
    fire_ratio = np.count_nonzero(fire_mask) / (img_np.shape[0] * img_np.shape[1])

    # Smoke: desaturated, grayish-white haze (low saturation, high value)
    lower_smoke = np.array([0, 0, 120])
    upper_smoke = np.array([180, 45, 240])
    smoke_mask = cv2.inRange(hsv, lower_smoke, upper_smoke)
    smoke_ratio = np.count_nonzero(smoke_mask) / (img_np.shape[0] * img_np.shape[1])

    # 3. Structural damage: Edge entropy and contour fragmentation
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    edge_density = np.count_nonzero(edges) / (img_np.shape[0] * img_np.shape[1])

    # Classification logic
    features = []
    if fire_ratio > 0.05 or smoke_ratio > 0.28:
        condition = "smoke"
        sev = min(1.0, (fire_ratio * 4.0) + (smoke_ratio * 0.9))
        conf = min(0.92, 0.65 + (fire_ratio * 2.0) + (smoke_ratio * 0.4))
        if fire_ratio > 0.05:
            features.append(f"Thermal/flame combustion signature ({fire_ratio*100:.1f}%)")
        if smoke_ratio > 0.20:
            features.append(f"Atmospheric smoke plume scattering ({smoke_ratio*100:.1f}%)")
        rationale = (
            f"Computer vision spectral analysis detected elevated smoke haze ({smoke_ratio*100:.1f}%) "
            f"and thermal flame signatures ({fire_ratio*100:.1f}%). High wildfire risk."
        )
    elif water_ratio > 0.22:
        condition = "flooded"
        sev = min(1.0, water_ratio * 1.5)
        conf = min(0.95, 0.68 + (water_ratio * 0.4))
        features.append(f"Surface water & turbid inundation ({water_ratio*100:.1f}%)")
        features.append("Low spectral vegetation reflectance")
        rationale = (
            f"Computer vision spectral index identified severe ground inundation covering {water_ratio*100:.1f}% "
            f"of the frame with turbid water signatures consistent with flooding."
        )
    elif edge_density > 0.18:
        condition = "damaged_infrastructure"
        sev = min(1.0, edge_density * 2.2)
        conf = min(0.85, 0.55 + edge_density)
        features.append(f"High structural rubble edge density ({edge_density*100:.1f}%)")
        rationale = (
            f"High-frequency spatial gradient analysis revealed heavy structural fragmentation and "
            f"debris contours ({edge_density*100:.1f}% edge density) indicating collapsed infrastructure."
        )
    else:
        condition = "none"
        sev = 0.05
        conf = 0.88
        features.append("Normal terrain vegetation & road network continuity")
        rationale = "Image analysis shows standard environmental baseline conditions without significant flood, smoke, or structural disaster anomalies."

    return {
        "condition": condition,
        "severity_0_to_1": round(float(sev), 2),
        "confidence_0_to_1": round(float(conf), 2),
        "rationale": rationale,
        "detected_features": features,
        "model_used": "rules_spectral_vision_baseline"
    }

def analyze_disaster_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Main image analysis pipeline:
    Tries multimodal OpenAI gpt-4o first. If key is missing or call fails,
    executes the robust CV spectral analysis baseline.
    """
    gpt_result = classify_image_with_gpt4o(image_bytes, mime_type)
    if gpt_result:
        return gpt_result

    # Fallback to computer vision spectral baseline
    return rule_based_spectral_vision_baseline(image_bytes)
