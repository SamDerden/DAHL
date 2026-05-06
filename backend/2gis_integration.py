import requests
import os
from typing import List, Dict, Optional

class TwoGISIntegration:
    """Интеграция с 2ГИС API для получения данных о местах"""
    
    def __init__(self):
        self.api_key = os.getenv("TWO_GIS_API_KEY")
        self.base_url = "https://catalog.api.2gis.com/3.0"
    
    def get_place_data(self, name: str, city: str = None) -> Optional[Dict]:
        """
        Получить данные о месте из 2ГИС
        """
        try:
            search_url = f"{self.base_url}/items"
            params = {
                "key": self.api_key,
                "q": name,
                "fields": "items.address,items.reviews_count,items.rating,items.photos,items.work_hours,items.point"
            }
            
            if city:
                params["q"] += f", {city}"
            
            response = requests.get(search_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get("result", {}).get("items"):
                place = data["result"]["items"][0]
                return {
                    "id_2gis": place.get("id"),
                    "name": place.get("name"),
                    "address": place.get("address", {}).get("address_string"),
                    "lat": place.get("point", {}).get("lat"),
                    "lng": place.get("point", {}).get("lon"),
                    "rating": place.get("rating"),
                    "reviews_count": place.get("reviews_count"),
                    "photos": [p["url"] for p in place.get("photos", [])[:5]],
                    "work_hours": place.get("work_hours"),
                    "source": "2gis"
                }
            
            return None
        except Exception as e:
            print(f"Ошибка 2ГИС API: {e}")
            return None
