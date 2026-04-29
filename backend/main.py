from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import List, Optional
import uuid
from geopy.distance import geodesic as geopy_distance
import requests
from dotenv import load_dotenv
import os
import re

load_dotenv()

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ Ключи и настройки ------------------
YANDEX_GPT_API_KEY = os.getenv("YANDEX_GPT_API_KEY")
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID")
YANDEX_GPT_MODEL_URI = f"gpt://{YANDEX_FOLDER_ID}/yandexgpt-lite"
YANDEX_GPT_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
YANDEX_GEOCODER_API_KEY = os.getenv("YANDEX_GEOCODER_API_KEY")
GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"

# ------------------ Центры городов и максимальное расстояние ------------------
CITY_CENTERS = {
    "Москва": (55.7558, 37.6173),
    "Санкт-Петербург": (59.9343, 30.3351),
    "Екатеринбург": (56.8380, 60.6030),
    "Казань": (55.7961, 49.1064),
    "Сочи": (43.5855, 39.7231),
    "Нижний Новгород": (56.3269, 44.0075),
    "Калининград": (54.7104, 20.4522),
    "Владивосток": (43.1155, 131.8855),
    "Новосибирск": (55.0084, 82.9357),
}
MAX_DISTANCE_KM = 30  # для городского маршрута точки дальше 30 км от центра игнорируются

# ------------------ Хранилища ------------------
users = {}
tokens = {}
plans = {}
ready_routes = [
    {"id": "1", "name": "Екатеринбург за день", "places": [
        {"name": "Плотинка", "lat": 56.838, "lng": 60.603},
        {"name": "Ельцин Центр", "lat": 56.844, "lng": 60.595}
    ]},
    {"id": "2", "name": "Музеи", "places": [
        {"name": "Эрмитаж", "lat": 56.836, "lng": 60.605}
    ]}
]
places_db = [
    {"name": "Плотинка (Екатеринбург)", "lat": 56.838, "lng": 60.603, "category": "достопримечательность", "work_hours": "09:00-18:00"},
    {"name": "Ельцин Центр", "lat": 56.844, "lng": 60.595, "category": "музей", "work_hours": "10:00-20:00"},
    {"name": "Храм-на-Крови", "lat": 56.844, "lng": 60.610, "category": "религия", "work_hours": "08:00-19:00"},
]

# ------------------ Модели ------------------
class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class PlaceCreate(BaseModel):
    name: str
    lat: float
    lng: float

class PlanCreate(BaseModel):
    name: str

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Нет токена")
    token = authorization.split(" ")[1]
    email = tokens.get(token)
    if not email:
        raise HTTPException(status_code=401, detail="Неверный токен")
    return email

# ------------------ Упрощение названия места ------------------
def simplify_name(name: str, city: str) -> Optional[str]:
    """Удаляет из названия упоминание города и общие слова (музей, театр, парк и т.п.), оставляя ключевую часть."""
    # Удаляем город
    city_lower = city.lower()
    name_lower = name.lower()
    simplified = name_lower
    if city_lower in simplified:
        # Удаляем вхождение города и чистим пробелы
        idx = simplified.find(city_lower)
        before = name[:idx].rstrip()
        after = name[idx+len(city):].lstrip()
        simplified = (before + " " + after).strip()

    # Удаляем слова-типы (можно расширить)
    stop_words = ["музей", "театр", "парк", "памятник", "собор", "церковь", "костёл", "мечеть", "галерея"]
    for word in stop_words:
        simplified = re.sub(r'\b' + word + r'\b', '', simplified, flags=re.IGNORECASE)
    # Удаляем лишние пробелы
    simplified = re.sub(r'\s+', ' ', simplified).strip()
    return simplified if simplified else None

# ------------------ Геокодирование ------------------
def geocode_place(name: str, context_city: str = None) -> Optional[dict]:
    queries_to_try = []
    if context_city:
        queries_to_try.append(f"{name}, {context_city}")
        queries_to_try.append(f"{name} {context_city}")
        simplified = simplify_name(name, context_city)
        if simplified:
            queries_to_try.append(f"{simplified}, {context_city}")
            queries_to_try.append(f"{simplified} {context_city}")
    queries_to_try.append(name)

    for query in queries_to_try:
        coords = _geocode_raw(query)
        if coords:
            if context_city and context_city in CITY_CENTERS:
                center = CITY_CENTERS[context_city]
                dist = geopy_distance(center, coords).km
                if dist > MAX_DISTANCE_KM:
                    print(f"Координаты ({coords[0]:.4f}, {coords[1]:.4f}) для '{name}' слишком далеко от {context_city} ({dist:.0f} км), игнорируем")
                    continue
            return {"name": name, "lat": coords[0], "lng": coords[1]}
    print(f"Не удалось найти координаты для места: {name}")
    return None

def _geocode_raw(query: str) -> Optional[tuple]:
    try:
        params = {
            "apikey": YANDEX_GEOCODER_API_KEY,
            "geocode": query,
            "format": "json",
            "results": 1,
            "lang": "ru_RU"
        }
        resp = requests.get(GEOCODER_URL, params=params)
        resp.raise_for_status()
        data = resp.json()
        geo_collection = data["response"]["GeoObjectCollection"]
        if geo_collection["metaDataProperty"]["GeocoderResponseMetaData"]["found"] == "0":
            return None
        obj = geo_collection["featureMember"][0]["GeoObject"]
        pos = obj["Point"]["pos"]
        lon, lat = pos.split()
        return float(lat), float(lon)
    except Exception as e:
        print(f"Ошибка геокодирования '{query}': {e}")
        return None

# ------------------ Аутентификация ------------------
@app.post("/auth/register")
def register(user: UserRegister):
    if user.email in users:
        raise HTTPException(status_code=400, detail="Уже существует")
    users[user.email] = {"username": user.username, "password": user.password}
    return {"message": "OK"}

@app.post("/auth/login")
def login(user: UserLogin):
    u = users.get(user.email)
    if not u or u["password"] != user.password:
        raise HTTPException(status_code=401, detail="Неверные данные")
    token = str(uuid.uuid4())
    tokens[token] = user.email
    return {"access_token": token, "user": {"username": u["username"], "email": user.email}}

# ------------------ Планы ------------------
@app.post("/plans")
def create_plan(plan: PlanCreate, user=Depends(get_current_user)):
    plan_id = str(uuid.uuid4())
    plans[plan_id] = {"owner": user, "name": plan.name, "places": []}
    return {"plan_id": plan_id, "name": plan.name}

@app.get("/plans")
def get_plans(user=Depends(get_current_user)):
    user_plans = []
    for pid, pdata in plans.items():
        if pdata["owner"] == user:
            user_plans.append({"id": pid, "name": pdata["name"], "places": pdata["places"]})
    return user_plans

@app.get("/plans/{plan_id}")
def get_plan(plan_id: str, user=Depends(get_current_user)):
    plan = plans.get(plan_id)
    if not plan or plan["owner"] != user:
        raise HTTPException(status_code=404, detail="План не найден")
    return {"id": plan_id, "name": plan["name"], "places": plan["places"]}

@app.post("/plans/{plan_id}/places")
def add_place_to_plan(plan_id: str, place: PlaceCreate, user=Depends(get_current_user)):
    plan = plans.get(plan_id)
    if not plan or plan["owner"] != user:
        raise HTTPException(status_code=404, detail="План не найден")
    plan["places"].append(place.model_dump())
    return plan

@app.post("/plans/{plan_id}/optimize")
def optimize_plan(plan_id: str, user=Depends(get_current_user)):
    plan = plans.get(plan_id)
    if not plan or plan["owner"] != user:
        raise HTTPException(status_code=404)
    places_list = plan["places"]
    if len(places_list) <= 2:
        return {"optimized_route": places_list}
    remaining = places_list.copy()
    ordered = []
    current = remaining.pop(0)
    ordered.append(current)
    while remaining:
        next_point = min(remaining, key=lambda p: geopy_distance((current["lat"], current["lng"]), (p["lat"], p["lng"])).km)
        remaining.remove(next_point)
        ordered.append(next_point)
        current = next_point
    plan["places"] = ordered
    return {"optimized_route": ordered}

# ------------------ Готовые маршруты ------------------
@app.get("/ready-routes")
def get_ready_routes():
    return ready_routes

# ------------------ AI подбор мест ------------------
@app.get("/places/search")
def search_places(q: str):
    results = []
    for p in places_db:
        if q.lower() in p["name"].lower() or q.lower() in p["category"].lower():
            results.append(p)
    return results

# ------------------ AI-ассистент ------------------
@app.post("/ai-assistant")
async def ai_assistant(query: dict):
    prompt = query.get("prompt", "")
    if not prompt:
        raise HTTPException(status_code=400, detail="Пустой запрос")

    context_city = extract_city_from_prompt(prompt)
    print(f"Определён город: {context_city}")

    system_prompt = (
        "Ты — персональный ассистент для планирования путешествий по России. "
        "Пользователь описывает, куда он хочет поехать и какие даты. "
        "Предложи оптимальный маршрут на 1-3 дня в указанном городе или регионе. "
        "Твой ответ ОБЯЗАТЕЛЬНО должен заканчиваться отдельной строкой 'МЕСТА:', "
        "после которой перечисли конкретные названия мест, каждое с новой строки, "
        "без маркеров, без звёздочек, просто текст. Например:\n"
        "МЕСТА:\n"
        "Эйфелева башня\n"
        "Лувр\n"
        "...\n"
        "НЕ ИСПОЛЬЗУЙ в этом блоке жирный шрифт или другие украшения."
    )

    data = {
        "modelUri": YANDEX_GPT_MODEL_URI,
        "completionOptions": {
            "stream": False,
            "temperature": 0.7,
            "maxTokens": 1000
        },
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": prompt}
        ]
    }
    headers = {
        "Authorization": f"Api-Key {YANDEX_GPT_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(YANDEX_GPT_URL, json=data, headers=headers)
        response.raise_for_status()
        result = response.json()
        full_text = result["result"]["alternatives"][0]["message"]["text"]
    except requests.RequestException as e:
        print(f"Ошибка YandexGPT: {e}")
        raise HTTPException(status_code=503, detail="Сервис AI временно недоступен")
    except (KeyError, IndexError) as e:
        print(f"Некорректный ответ от YandexGPT: {e}")
        return {"answer": "Извините, не удалось сформировать ответ.", "places": []}

    places = []
    answer_text = full_text

    if "МЕСТА:" in full_text:
        parts = full_text.split("МЕСТА:")
        answer_text = parts[0].strip()
        raw_places = parts[1].strip().splitlines()
    else:
        matches = re.findall(r'\*\*(.+?)\*\*', full_text)
        if matches:
            raw_places = [m.strip() for m in matches if m.strip()]
            answer_text = re.sub(r'\*\*.*?\*\*', '', full_text).strip()
        else:
            raw_places = []

    for line in raw_places:
        name = line.strip()
        if name and not name.startswith("-"):
            geocoded = geocode_place(name, context_city)
            if geocoded:
                places.append(geocoded)
                print(f"Найдено: {name} -> ({geocoded['lat']}, {geocoded['lng']})")
            else:
                print(f"Не найдено: {name}")

    return {"answer": answer_text, "places": places}

def extract_city_from_prompt(prompt: str) -> Optional[str]:
    known = ["Москва", "Санкт-Петербург", "Екатеринбург", "Казань", "Сочи",
             "Нижний Новгород", "Калининград", "Владивосток", "Новосибирск"]
    variations = {
        "Екатеринбург": ["екатеринбруг", "екатеринбур", "екб", "екат"],
        "Санкт-Петербург": ["питер", "спб", "санкт-петербург"],
    }
    prompt_lower = prompt.lower()
    for city in known:
        if city.lower() in prompt_lower:
            return city
    for city, alts in variations.items():
        for alt in alts:
            if alt in prompt_lower:
                return city
    return None