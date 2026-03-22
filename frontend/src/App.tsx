import { Route, Routes } from 'react-router-dom'
import InsightWorkspacePage from './pages/InsightWorkspacePage'
import LandingPage from './pages/LandingPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/map" element={<InsightWorkspacePage />} />
    </Routes>
  )
}
