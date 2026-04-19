import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const Home = () => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start px-4 pt-14">

      <div className="w-full max-w-4xl mx-auto text-center py-16" data-aos="fade-up">
        <div className="flex items-center justify-center gap-2 mb-4" data-aos="zoom-in" data-aos-delay="100">
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            Live
          </span>
          <span className="text-gray-600">-</span>
          <span className="text-lg font-medium text-gray-800">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6" data-aos="fade-up" data-aos-delay="200">
          E-Voting System
        </h1>

        <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed" data-aos="fade-up" data-aos-delay="400">
          Welcome to the secure and transparent online voting platform for TEIN Greenfield Chapter. Cast your vote easily,
          securely, and from anywhere with our modern e-voting experience.
        </p>

      

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4" data-aos="fade-up" data-aos-delay="1000">
          <button
            onClick={() => navigate('/vote')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-3xl text-lg transition duration-300 transform hover:scale-105 shadow-lg"
          >
            Begin Voting
          </button>
          <button className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold py-4 px-8 rounded-3xl text-lg transition duration-300 shadow-sm">
            Track Polls
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-3 py-8 border-t border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-500">
            © P-Dan Technologies. All rights reserved
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Home
