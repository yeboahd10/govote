import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInAdmin } from '../utils/adminAuth'
import logo from '../assets/logo.png'

const NavBar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminCredentials, setAdminCredentials] = useState({ email: '', password: '' })
  const [adminError, setAdminError] = useState('')
  const navigate = useNavigate()

  const handleAdminLogin = async (e) => {
    e.preventDefault()
    setAdminError('')

    try {
      await signInAdmin(adminCredentials.email, adminCredentials.password)
      setShowAdminModal(false)
      setAdminCredentials({ email: '', password: '' })
      setAdminError('')
      navigate('/admin')
    } catch (error) {
      if (error.code === 'admin-profile-missing') {
        setAdminError(`Login succeeded, but no matching Firestore admin profile was found for UID: ${error.uid}. Create the document at admins/${error.uid}.`)
        return
      }

      if (error.code === 'admin-disabled') {
        setAdminError('This admin account is disabled. Set active to true in the Firestore admin document.')
        return
      }

      if (error.code === 'admin-profile-read-denied') {
        setAdminError('Login succeeded, but Firestore rules blocked reading your admin profile. Publish the latest firestore.rules and confirm the document is stored at admins/{uid}.')
        return
      }

      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        setAdminError('Invalid email or password.')
        return
      }

      setAdminError('Admin login failed. Check the browser console for the exact Firebase error.')
      console.error('Admin login failed:', error)
    }
  }

  return (
    <nav className="fixed inset-x-0 top-0 z-30 bg-white border-b border-gray-200 shadow-sm ">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 ">
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <img
            src={logo}
            alt="TEIN Greenfield Logo"
            className="w-16 h-16 rounded-full object-contain"
          />
          <div className="leading-tight">
            <p className="text-xs font-semibold uppercase tracking-[0.38em] text-indigo-600">TEIN</p>
            <p className="text-xl sm:text-2xl font-black tracking-tight text-gray-900">Greenfield</p>
            <p className="text-sm font-medium uppercase tracking-widest text-gray-500">Chapter</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">
          <button onClick={() => navigate('/')} className="transition hover:text-indigo-600">Home</button>
          <button onClick={() => navigate('/vote')} className="transition hover:text-indigo-600">Vote</button>
          <button onClick={() => setShowAdminModal(true)} className="transition hover:text-indigo-600">Admin</button>
        </div>

        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="flex flex-col justify-center items-center w-8 h-8 space-y-1 text-gray-700 hover:text-indigo-600 transition md:hidden"
          aria-label="Toggle navigation menu"
        >
          <span className={`block w-6 h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`block w-6 h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-6 h-0.5 bg-current transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close mobile menu"
          />
          <div className={`absolute right-0 top-0 h-full w-72 bg-white shadow-2xl border-l border-gray-200 p-6 transform transition-transform duration-500 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex items-center justify-between mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">Menu</p>
              <button
                className="text-gray-700 hover:text-indigo-600"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
            <nav className="flex flex-col text-lg font-medium text-gray-800">
              <button
                onClick={() => {
                  navigate('/')
                  setIsMenuOpen(false)
                }}
                className="flex items-center justify-between rounded-2xl px-4 py-4 hover:bg-indigo-50 transition border-b border-gray-200 text-left w-full"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">🏠</span>
                  Home
                </span>
              </button>
              <button
                onClick={() => {
                  navigate('/vote')
                  setIsMenuOpen(false)
                }}
                className="flex items-center justify-between rounded-2xl px-4 py-4 hover:bg-indigo-50 transition border-b border-gray-200 text-left w-full"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">🗳️</span>
                  Vote
                </span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false)
                  setShowAdminModal(true)
                }}
                className="flex items-center justify-between rounded-2xl px-4 py-4 hover:bg-indigo-50 transition text-left"
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">🔒</span>
                  Admin
                </span>
              </button>
            </nav>
            <div className="mt-8 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                © P-Dan Technologies. All rights reserved
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md mx-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h2>
              <p className="text-gray-600">Enter your credentials to access admin panel</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={adminCredentials.email}
                  onChange={(e) => setAdminCredentials({ ...adminCredentials, email: e.target.value })}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                  placeholder="Enter admin email"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={adminCredentials.password}
                  onChange={(e) => setAdminCredentials({ ...adminCredentials, password: e.target.value })}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                  placeholder="Enter password"
                  required
                />
              </div>

              {adminError && (
                <p className="text-red-600 text-sm text-center">{adminError}</p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false)
                    setAdminCredentials({ email: '', password: '' })
                    setAdminError('')
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-6 rounded-2xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-2xl font-semibold transition"
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  )
}

export default NavBar
