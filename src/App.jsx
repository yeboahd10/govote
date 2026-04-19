import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import './App.css'
import NavBar from './Components/NavBar'
import Details from './Components/Details'
import Home from './Components/Home'
import VotePage from './Components/VotePage'
import LiveData from './Components/LiveData'
import Admin from './Components/Admin'

function App() {
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: true,
      offset: 100,
    })
  }, [])

  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vote" element={<Details />} />
        <Route path="/voting" element={<VotePage />} />
        <Route path="/live-feed" element={<LiveData />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  )
}

export default App
