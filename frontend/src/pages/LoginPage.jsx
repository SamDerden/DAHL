import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

const handleSubmit = async (e) => {
  e.preventDefault();
  console.log('1. Функция вызвана');
  setError('');
  
  try {
    console.log('2. Отправляю запрос...');
    const response = await axios.post('http://localhost:8002/auth/login', {
      email,
      password
    });
    console.log('3. Ответ получен:', response.data);
    localStorage.setItem('token', response.data.access_token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    navigate('/dashboard');
  } catch (err) {
    console.error('4. Ошибка:', err);
    if (err.response) {
      // Сервер ответил, но статус не 2xx
      console.error('Статус ответа:', err.response.status);
      console.error('Тело ответа:', err.response.data);
      setError(err.response.data?.detail || 'Ошибка входа');
    } else if (err.request) {
      // Запрос был сделан, но ответ не получен
      console.error('Сервер не отвечает. Проверь, запущен ли бэкенд на порту 8002');
      setError('Сервер недоступен');
    } else {
      // Что-то пошло не так при настройке запроса
      console.error('Ошибка настройки запроса:', err.message);
      setError('Неизвестная ошибка');
    }
  }
  console.log('5. Обработка завершена');
};

  return (
    <div className="page-container">
      <h1 className="app-title">Даль</h1>
      <form onSubmit={handleSubmit}>
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
        <button className="btn btn-primary" type="submit">Войти</button>
      </form>
      {error && <div className="error-message">{error}</div>}
      <div className="helper-text">
        Нет аккаунта? <Link className="text-link" to="/register">Зарегистрироваться</Link>
      </div>
    </div>
  )
}

export default LoginPage