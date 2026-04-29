import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

function RegisterPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await axios.post('http://localhost:8002/auth/register', { username, email, password })
      const loginRes = await axios.post('http://localhost:8002/auth/login', { email, password })
      localStorage.setItem('token', loginRes.data.access_token)
      localStorage.setItem('user', JSON.stringify(loginRes.data.user))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка регистрации')
    }
  }

  return (
    <div className="page-container">
      <h1 className="app-title">Даль · Регистрация</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            className="form-input"
            type="text"
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <input
            className="form-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <input
            className="form-input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit">Зарегистрироваться</button>
      </form>
      {error && <div className="error-message">{error}</div>}
      <div className="helper-text">
        Уже есть аккаунт? <Link className="text-link" to="/login">Войти</Link>
      </div>
    </div>
  )
}

export default RegisterPage