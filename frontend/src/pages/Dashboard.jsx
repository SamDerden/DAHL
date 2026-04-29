import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [readyRoutes, setReadyRoutes] = useState([])
  const token = localStorage.getItem('token')

  // Проверка авторизации
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [token, navigate])

  // Загрузка готовых маршрутов с бэкенда
  useEffect(() => {
    axios.get('http://localhost:8002/ready-routes')
      .then(res => setReadyRoutes(res.data))
      .catch(err => console.error('Ошибка загрузки готовых маршрутов:', err))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (!user) return <div>Загрузка...</div>

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      <h1>Добро пожаловать, {user.username}!</h1>
      <p>Это ваш личный кабинет.</p>
      
      <Link to="/new-plan">
        <button className="btn btn-primary" style={{ marginBottom: '20px' }}>
          ✈️ Создать новый план
        </button>
      </Link>

      <hr />

      {/* Готовые маршруты */}
      <h2>Готовые маршруты</h2>
      {readyRoutes.length === 0 && <p>Загрузка готовых маршрутов...</p>}
      {readyRoutes.map(route => (
        <div key={route.id} style={{ margin: '10px 0', padding: '10px', border: '1px solid #ccc' }}>
          <h3>{route.name}</h3>
          <button className="btn btn-primary" onClick={() => {
            axios.post('http://localhost:8002/plans', { name: route.name }, {
              headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
              const planId = res.data.plan_id
              const promises = route.places.map(p =>
                axios.post(`http://localhost:8002/plans/${planId}/places`, p, {
                  headers: { Authorization: `Bearer ${token}` }
                })
              )
              Promise.all(promises).then(() => {
                navigate(`/plan/${planId}`)
              })
            }).catch(err => {
              console.error('Ошибка при создании плана из готового маршрута:', err)
              alert('Не удалось создать план')
            })
          }}>Выбрать</button>
        </div>
      ))}

      <hr />
      <button className="btn btn-primary" onClick={handleLogout}>Выйти</button>
    </div>
  )
}

export default Dashboard