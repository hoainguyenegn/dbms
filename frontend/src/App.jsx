import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'

export default function App() {
  if (window.location.pathname === '/my-tickets' || window.location.pathname === '/checkout') {
    return <BookingPage />
  }
  return <HomePage />
}
