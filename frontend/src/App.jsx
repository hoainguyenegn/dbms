import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import ReservationPage from './pages/ReservationPage'

export default function App() {
  if (window.location.pathname === '/reserve') {
    return <ReservationPage />
  }
  if (window.location.pathname === '/my-tickets' || window.location.pathname === '/checkout') {
    return <BookingPage />
  }
  return <HomePage />
}
