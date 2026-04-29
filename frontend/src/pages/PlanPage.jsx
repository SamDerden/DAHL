import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { YMaps, Map, Placemark, Polyline } from '@pbe/react-yandex-maps'
import axios from 'axios'

function PlanPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [places, setPlaces] = useState([])
  const [planName, setPlanName] = useState('Новый план')
  const [mapState, setMapState] = useState({ center: [56.838, 60.603], zoom: 12 })
  const [selectedCoords, setSelectedCoords] = useState(null)
  const [newPlaceName, setNewPlaceName] = useState('')
  const token = localStorage.getItem('token')
  const mapRef = useRef(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

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

  // Функция для автоматического зумирования
  const fitMapToPlaces = useCallback((placesList) => {
    if (!mapRef.current || placesList.length === 0) return
    if (placesList.length === 1) {
      const p = placesList[0]
      mapRef.current.setCenter([p.lat, p.lng], 14)
      return
    }
    // Находим границы
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
    placesList.forEach(p => {
      if (p.lat < minLat) minLat = p.lat
      if (p.lat > maxLat) maxLat = p.lat
      if (p.lng < minLng) minLng = p.lng
      if (p.lng > maxLng) maxLng = p.lng
    })
    const center = [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
    // Оцениваем зум по разбросу (грубо)
    const latDiff = maxLat - minLat
    const lngDiff = maxLng - minLng
    let zoom = 15
    if (latDiff > 0.02 || lngDiff > 0.02) zoom = 13
    if (latDiff > 0.05 || lngDiff > 0.05) zoom = 11
    if (latDiff > 0.2 || lngDiff > 0.2) zoom = 8
    mapRef.current.setCenter(center, zoom)
  }, [])

  // При изменении places зумируем
  useEffect(() => {
    fitMapToPlaces(places)
  }, [places, fitMapToPlaces])

  const addPlace = async () => {
    if (!selectedCoords || !newPlaceName.trim()) return
    const [lat, lng] = selectedCoords
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

  const onMapClick = (e) => {
    const coords = e.get('coords')
    setSelectedCoords(coords)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const res = await axios.get('http://localhost:8002/places/search', {
        params: { q: searchQuery }
      })
      setSearchResults(res.data)
    } catch (err) {
      console.error('Ошибка поиска мест:', err)
    }
  }

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
      console.log('Ответ ассистента:', res.data)
      if (res.data.places && res.data.places.length > 0) {
        for (const place of res.data.places) {
          console.log('Добавляю место:', place)
          await addPlaceDirectly(place.name, place.lat, place.lng)
        }
        const updated = await axios.get(`http://localhost:8002/plans/${planId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setPlaces(updated.data.places)
      } else {
        console.warn('Места не получены от ассистента')
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
        <div style={{ width: '70%' }}>
          <YMaps query={{ apikey: import.meta.env.VITE_YANDEX_MAPS_API_KEY }}>
            <Map
              state={mapState}
              width="100%"
              height="500px"
              onClick={onMapClick}
              instanceRef={mapRef}
            >
              {places.map((p, i) => (
                <Placemark key={i} geometry={[p.lat, p.lng]} properties={{ balloonContent: p.name }} />
              ))}
              {places.length > 1 && (
                <Polyline
                  geometry={places.map(p => [p.lat, p.lng])}
                  options={{
                    strokeColor: '#409eff',
                    strokeWidth: 3,
                    strokeOpacity: 0.8
                  }}
                />
              )}
              {selectedCoords && <Placemark geometry={selectedCoords} properties={{ balloonContent: 'Новое место' }} />}
            </Map>
          </YMaps>
        </div>
        <div style={{ width: '30%', paddingLeft: '10px' }}>
          <button onClick={optimize} className="btn btn-primary" style={{ marginBottom: '10px' }}>Оптимизировать маршрут</button>

          <h3>AI-помощник</h3>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Куда хотите поехать? Например: Казань на 2 дня"
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
                <small>{place.address}</small><br/>
                <small>Часы работы: {place.work_hours}</small>
                <button className="btn btn-primary" style={{ marginTop: '5px' }} onClick={() => {
                  axios.post(`http://localhost:8002/plans/${planId}/places`, {
                    name: place.name, lat: place.lat, lng: place.lng
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
              <button onClick={addPlace} className="btn btn-primary" style={{ marginTop: '5px' }}>Добавить</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlanPage