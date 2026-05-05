import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

// SVG-иконка для единообразных пронумерованных маркеров
const markerIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 24 16 24s16-12 16-24C32 7.164 24.836 0 16 0z" fill="#007AFF"/>
  <text x="16" y="21" font-size="14" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle"></text>
</svg>`
const markerIconUrl = 'data:image/svg+xml;base64,' + btoa(markerIconSvg)

function PlanPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [places, setPlaces] = useState([])
  const [planName, setPlanName] = useState('Новый план')
  const [selectedCoords, setSelectedCoords] = useState(null)
  const [newPlaceName, setNewPlaceName] = useState('')
  const token = localStorage.getItem('token')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const mapContainer = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const directionsRef = useRef(null)

  const apiKey = import.meta.env.VITE_MAPGL_API_KEY

  // Инициализация карты 2ГИС
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return

    const map = new mapgl.Map(mapContainer.current, {
      center: [60.603, 56.838], // Екатеринбург: [lng, lat]
      zoom: 12,
      key: apiKey,
    })
    mapInstance.current = map

    const directions = new mapgl.Directions(map, {
      directionsApiKey: apiKey,
    })
    directionsRef.current = directions

    // Клик по карте – всегда сохраняем координаты для нового места
    map.on('click', (event) => {
      const coords = event.lngLat
      setSelectedCoords(coords)
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy()
        mapInstance.current = null
        directionsRef.current = null
      }
    }
  }, [apiKey])

  // Функция обновления маркеров (переиспользуемая)
  const updateMarkers = useCallback((placesList) => {
    if (!mapInstance.current) return

    // Удаляем старые маркеры
    markersRef.current.forEach(marker => marker.destroy())
    markersRef.current = []

    if (placesList.length === 0) return

    // Создаём новые маркеры с номерами
    placesList.forEach((place, idx) => {
      const marker = new mapgl.Marker(mapInstance.current, {
        coordinates: [place.lng, place.lat],
        icon: markerIconUrl,
        label: {
          text: String(idx + 1),
          offset: [0, -3],
          relativeAnchor: [0.5, 0.5],
        },
      })
      markersRef.current.push(marker)
    })
  }, [])

  // Построение/очистка маршрута при изменении списка мест
  useEffect(() => {
    if (!mapInstance.current || !directionsRef.current) return

    // Очищаем старый маршрут
    directionsRef.current.clear()

    if (places.length < 2) {
      updateMarkers(places)
      return
    }

    const points = places.map(p => [p.lng, p.lat])

    // Строим пешеходный маршрут БЕЗ автоматических маркеров (букв)
    directionsRef.current.pedestrianRoute({
      points,
      // Отключаем встроенные маркеры
      routeMarker: false,
      // Стиль только для основной линии
      style: {
        haloLineWidth: 0,
        substrateLineWidth: 0,
        routeLineWidth: 4,
        routeLineColor: '#007AFF',
      },
    }).catch(err => {
      console.error('Не удалось построить пешеходный маршрут:', err)
    })

    // Обновляем наши кастомные маркеры
    updateMarkers(places)

    // Подгоняем карту
    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
    places.forEach(p => {
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
    })

    const centerLng = (minLng + maxLng) / 2
    const centerLat = (minLat + maxLat) / 2
    const latDiff = maxLat - minLat
    const lngDiff = maxLng - minLng

    let zoom = 15
    if (latDiff > 0.02 || lngDiff > 0.02) zoom = 13
    if (latDiff > 0.05 || lngDiff > 0.05) zoom = 11
    if (latDiff > 0.2 || lngDiff > 0.2) zoom = 8

    mapInstance.current.setCenter([centerLng, centerLat])
    mapInstance.current.setZoom(zoom)
  }, [places, updateMarkers])

  // Загрузка плана
  useEffect(() => {
    if (planId) {
      axios.get(`http://localhost:8002/plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        setPlanName(res.data.name)
        setPlaces(res.data.places)
      }).catch(() => alert('План не найден'))
    } else {
      axios.post('http://localhost:8002/plans', { name: 'Новый план' }, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        navigate(`/plan/${res.data.plan_id}`, { replace: true })
      })
    }
  }, [planId, token, navigate])

  // Ручное добавление новой точки (после клика по карте)
  const addPlaceManual = async () => {
    if (!selectedCoords || !newPlaceName.trim()) return
    const [lng, lat] = selectedCoords
    try {
      await axios.post(`http://localhost:8002/plans/${planId}/places`, {
        name: newPlaceName,
        lat,
        lng
      }, { headers: { Authorization: `Bearer ${token}` } })
      const updated = await axios.get(`http://localhost:8002/plans/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPlaces(updated.data.places)
      setNewPlaceName('')
      setSelectedCoords(null)
    } catch (err) {
      console.error('Ошибка добавления места:', err)
    }
  }

  // Прямое добавление места из AI/поиска
  const addPlaceDirectly = async (name, lat, lng) => {
    try {
      await axios.post(`http://localhost:8002/plans/${planId}/places`, {
        name,
        lat,
        lng
      }, { headers: { Authorization: `Bearer ${token}` } })
    } catch (err) {
      console.error(`Ошибка добавления "${name}":`, err)
    }
  }

  const optimize = async () => {
    try {
      const res = await axios.post(`http://localhost:8002/plans/${planId}/optimize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPlaces(res.data.optimized_route)
    } catch (err) {
      console.error('Ошибка оптимизации:', err)
    }
  }

  // Поиск организаций через API 2ГИС (по названию/категории)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      // Используем геокодер 2ГИС для поиска организаций
      const response = await axios.get('https://catalog.api.2gis.com/3.0/items', {
        params: {
          q: searchQuery,
          key: apiKey,
          locale: 'ru_RU',
          region_id: 36, // Екатеринбург (можно динамически подставлять)
          page_size: 5,
        }
      })
      const items = response.data?.result?.items || []
      const results = items.map(item => ({
        name: item.name,
        lat: item.point?.lat,
        lng: item.point?.lon,
        category: item.rubrics?.[0]?.name || 'Общее',
        address: item.address_name || '',
      }))
      setSearchResults(results)
    } catch (err) {
      console.error('Ошибка поиска через 2ГИС:', err)
    }
  }

  const askAssistant = async () => {
    if (!aiPrompt.trim()) return
    setAiLoading(true)
    setAiAnswer('')
    try {
      const res = await axios.post('http://localhost:8002/ai-assistant',
        { prompt: aiPrompt },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAiAnswer(res.data.answer)
      if (res.data.places && res.data.places.length > 0) {
        for (const place of res.data.places) {
          await addPlaceDirectly(place.name, place.lat, place.lng)
        }
        const updated = await axios.get(`http://localhost:8002/plans/${planId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setPlaces(updated.data.places)
      }
    } catch (err) {
      console.error('Ошибка запроса к ассистенту:', err)
      setAiAnswer('Ошибка при обращении к ассистенту.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      <h2>{planName}</h2>
      <div style={{ display: 'flex' }}>
        <div style={{ width: '70%', height: '500px' }}>
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }}></div>
        </div>
        <div style={{ width: '30%', paddingLeft: '10px' }}>
          <button onClick={optimize} className="btn btn-primary" style={{ marginBottom: '10px' }}>
            Оптимизировать маршрут
          </button>

          <h3>AI-помощник</h3>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Куда хотите поехать?"
            />
            <button
              className="btn btn-primary"
              style={{ width: 'auto' }}
              onClick={askAssistant}
              disabled={aiLoading}
            >
              {aiLoading ? '...' : 'Спросить'}
            </button>
          </div>
          {aiAnswer && (
            <div style={{
              marginTop: '10px', padding: '10px', background: '#f0f7ff', borderRadius: '10px',
              whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '14px', maxHeight: '200px', overflowY: 'auto', marginBottom: '15px'
            }}>
              {aiAnswer}
            </div>
          )}

          <h3>Поиск мест</h3>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="form-input" placeholder="Поиск места" />
          <button onClick={handleSearch} className="btn btn-primary" style={{ marginTop: '5px', marginBottom: '10px' }}>Искать</button>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {searchResults.map((place, idx) => (
              <div key={idx} style={{ margin: '5px 0', padding: '5px', border: '1px solid #ddd' }}>
                <b>{place.name}</b> ({place.category})<br/>
                <small>{place.address}</small>
                <button className="btn btn-primary" style={{ marginTop: '5px' }} onClick={() => {
                  // Добавляем место из поиска
                  axios.post(`http://localhost:8002/plans/${planId}/places`, {
                    name: place.name,
                    lat: place.lat,
                    lng: place.lng
                  }, { headers: { Authorization: `Bearer ${token}` } })
                  .then(() => axios.get(`http://localhost:8002/plans/${planId}`, { headers: { Authorization: `Bearer ${token}` } }))
                  .then(res => setPlaces(res.data.places))
                  .catch(err => console.error(err))
                }}>Добавить</button>
              </div>
            ))}
          </div>

          <h3>Места в плане</h3>
          <ul>
            {places.map((p, i) => <li key={i}>{p.name} ({p.lat.toFixed(3)}, {p.lng.toFixed(3)})</li>)}
          </ul>
          {selectedCoords && (
            <div>
              <input value={newPlaceName} onChange={e => setNewPlaceName(e.target.value)} className="form-input" placeholder="Название места" />
              <button onClick={addPlaceManual} className="btn btn-primary" style={{ marginTop: '5px' }}>Добавить</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlanPage