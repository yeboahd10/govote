import React, { useEffect, useRef, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db, functions } from '../firebase'

const Details = () => {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [allStudents, setAllStudents] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [votingStatus, setVotingStatus] = useState('loading')
  const suggestionsRef = useRef(null)
  const nameInputRef = useRef(null)

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [votingDoc, studentSnapshot] = await Promise.all([
          getDoc(doc(db, 'settings', 'voting')),
          getDocs(collection(db, 'students')),
        ])

        if (votingDoc.exists()) {
          setVotingStatus(votingDoc.data()?.status === 'paused' ? 'paused' : 'active')
        } else {
          setVotingStatus('active')
        }

        const rows = studentSnapshot.docs.map((studentDoc) => {
          const data = studentDoc.data()
          return {
            name: data.name ?? '',
            studentId: data.studentId ?? '',
          }
        })

        setAllStudents(rows)
      } catch (loadError) {
        console.error('Failed to load details page data:', loadError)
        setVotingStatus('active')
      }
    }

    loadInitialData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        nameInputRef.current &&
        !nameInputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleNameChange = (e) => {
    const value = e.target.value
    setFullName(value)
    setActiveSuggestion(-1)

    if (value.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const query = value.trim().toLowerCase()
    const matched = allStudents
      .filter((student) => student.name.toLowerCase().includes(query))
      .slice(0, 8)

    setSuggestions(matched)
    setShowSuggestions(matched.length > 0)
  }

  const handleSelectSuggestion = (suggestion) => {
    setFullName(suggestion.name)
    setStudentId(suggestion.studentId)
    setSuggestions([])
    setShowSuggestions(false)
    setActiveSuggestion(-1)
  }

  const handleNameKeyDown = (e) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault()
      handleSelectSuggestion(suggestions[activeSuggestion])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

    if (votingStatus === 'loading') {
      setError('Please wait while we check voting status.')
      return
    }

    if (votingStatus === 'paused') {
      setError('Polls are closed now. Check back later.')
      return
    }

    const trimmedName = fullName.trim()
    const trimmedId = studentId.trim()

    if (!trimmedName || !trimmedId) {
      setError('Please enter both full name and student ID.')
      return
    }

    setIsVerifying(true)

    try {
      const verifyStudent = httpsCallable(functions, 'verifyStudent')
      const response = await verifyStudent({
        fullName: trimmedName,
        studentId: trimmedId,
      })

      const studentRecord = response.data.student

      navigate('/voting', {
        state: {
          student: {
            id: studentRecord.id,
            name: studentRecord.name,
            studentId: studentRecord.studentId,
          },
        },
      })
    } catch (verifyError) {
      console.error('Student verification failed:', verifyError)
      setError(verifyError.message || 'Could not verify right now. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  if (votingStatus === 'loading') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="rounded-3xl border border-gray-200 bg-gray-50 px-6 py-5 text-sm text-gray-700">
          Checking voting status...
        </div>
      </div>
    )
  }

  if (votingStatus === 'paused') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-red-50 border border-red-200 rounded-3xl p-10 shadow-lg">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-800 mb-2">Polls Are Closed</h1>
          <p className="text-red-700 text-base">Polls are closed now. Check back later.</p>
        </div>
        <footer className="mt-16 py-8 border-t border-gray-200 w-full">
          <div className="text-center">
            <p className="text-sm text-gray-500">© P-Dan Technologies. All rights reserved</p>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start px-4 pt-24">
      <section className="w-full max-w-3xl mx-auto px-4 py-16" data-aos="fade-up">
        <div className="bg-white shadow-2xl border border-gray-200 rounded-3xl p-10" data-aos="zoom-in" data-aos-delay="200">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Voter Details</h2>
          <p className="text-gray-600 mb-8">
            Enter your full name and voter ID to begin the voting process.
          </p>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div data-aos="fade-right" data-aos-delay="400" className="relative">
              <label htmlFor="full-name" className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="full-name"
                ref={nameInputRef}
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={handleNameChange}
                onKeyDown={handleNameKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                autoComplete="off"
                className="w-full rounded-3xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
              />
              {showSuggestions && (
                <ul
                  ref={suggestionsRef}
                  className="mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                >
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={`${suggestion.name}-${suggestion.studentId}`}
                      onMouseDown={() => handleSelectSuggestion(suggestion)}
                      className={`px-4 py-3 cursor-pointer text-sm transition-colors ${
                        index === activeSuggestion
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-900 hover:bg-indigo-50'
                      }`}
                    >
                      <span className="font-semibold">{suggestion.name}</span>
                      <span className={`ml-2 text-xs ${index === activeSuggestion ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {suggestion.studentId}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div data-aos="fade-left" data-aos-delay="500">
              <label htmlFor="voter-id" className="block text-sm font-semibold text-gray-700 mb-2">
                Student ID
              </label>
              <input
                id="voter-id"
                type="text"
                placeholder="Enter your ID number"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-3xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-3xl text-lg transition duration-300 shadow-lg"
              data-aos="fade-up" data-aos-delay="600"
            >
              {isVerifying ? 'Verifying...' : 'Start Vote'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-200">
        <div className="text-center">
          <p className="text-sm text-gray-500">
            © P-Dan Technologies. All rights reserved
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Details
