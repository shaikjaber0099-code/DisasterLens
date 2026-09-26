import httpx
from typing import Dict, Any, Optional
from backend.app.config import settings

def fetch_weather_for_coords(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches real-time worldwide weather.
    Uses OpenWeatherMap if key is provided; otherwise falls back to Open-Meteo (real-time, global, no key required).
    """
    api_key = settings.OPENWEATHER_API_KEY
    if api_key and api_key.strip():
        try:
            url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
            with httpx.Client(timeout=8.0) as client:
                res = client.get(url)
                if res.status_code == 200:
                    d = res.json()
                    return {
                        "temperature": float(d["main"]["temp"]),
                        "humidity": float(d["main"]["humidity"]),
                        "pressure": float(d["main"]["pressure"]),
                        "wind_speed": float(d["wind"]["speed"]) * 3.6, # convert m/s to km/h
                        "precipitation": float(d.get("rain", {}).get("1h", 0.0)),
                        "weather_condition": d["weather"][0]["main"] if d.get("weather") else "Clear",
                        "source": "OpenWeatherMap"
                    }
        except Exception as e:
            print(f"OpenWeatherMap failed: {e}. Falling back to Open-Meteo.")

    # Live global fallback: Open-Meteo
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,weather_code"
        )
        with httpx.Client(timeout=8.0) as client:
            res = client.get(url)
            if res.status_code == 200:
                data = res.json()
                current = data.get("current", {})
                code = current.get("weather_code", 0)
                condition = "Clear"
                if code in [51, 53, 55, 61, 63, 65, 80, 81, 82]:
                    condition = "Rain"
                elif code in [71, 73, 75, 85, 86]:
                    condition = "Snow"
                elif code in [95, 96, 99]:
                    condition = "Thunderstorm"
                elif code in [1, 2, 3]:
                    condition = "Cloudy"

                return {
                    "temperature": float(current.get("temperature_2m", 22.0)),
                    "humidity": float(current.get("relative_humidity_2m", 55.0)),
                    "pressure": float(current.get("surface_pressure", 1013.2)),
                    "wind_speed": float(current.get("wind_speed_10m", 12.0)),
                    "precipitation": float(current.get("precipitation", 0.0)),
                    "weather_condition": condition,
                    "source": "Open-Meteo (Live Global)"
                }
    except Exception as e:
        print(f"Open-Meteo query failed: {e}")

    # Baseline fallback if completely offline
    return {
        "temperature": 24.5,
        "humidity": 62.0,
        "pressure": 1012.0,
        "wind_speed": 14.2,
        "precipitation": 0.0,
        "weather_condition": "Clear",
        "source": "Simulated Atmospheric Baseline"
    }
