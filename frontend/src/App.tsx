import { useEffect, useState } from 'react'
import './App.css'

type Health = { status?: string; service?: string; error?: string }

function App() {
  const [django, setDjango] = useState<Health | null>(null)
  const [ai, setAi] = useState<Health | null>(null)

  useEffect(() => {
    fetch('/api/health/')
      .then((r) => r.json())
      .then(setDjango)
      .catch(() => setDjango({ error: 'unreachable' }))

    fetch('/ai/health')
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ error: 'unreachable' }))
  }, [])

  return (
    <div className="app">
      <header>
        <h1>Situate stack</h1>
        <p>Django + FastAPI + Vite (dev proxy)</p>
      </header>
      <ul className="status">
        <li>
          <strong>Django</strong>{' '}
          <code>/api/health/</code> —{' '}
          {django ? JSON.stringify(django) : '…'}
        </li>
        <li>
          <strong>AI service</strong> <code>/ai/health</code> —{' '}
          {ai ? JSON.stringify(ai) : '…'}
        </li>
      </ul>
    </div>
  )
}

export default App
