import React, { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs } from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'
import { db, functions } from '../firebase'
import { candidatePositions } from '../constants/candidates'

const VotePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const student = location.state?.student
  const [selectedCandidates, setSelectedCandidates] = useState({})
  const [currentTime, setCurrentTime] = useState(new Date())
  const [candidatesByPosition, setCandidatesByPosition] = useState(() =>
    Object.fromEntries(candidatePositions.map((position) => [position, []]))
  )
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true)
  const [candidateError, setCandidateError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmittingVote, setIsSubmittingVote] = useState(false)
  const visiblePositions = candidatePositions.filter((position) => (candidatesByPosition[position] ?? []).length > 0)

  const handleSelectCandidate = (position, candidateId) => {
    setSelectedCandidates((prev) => ({
      ...prev,
      [position]: candidateId,
    }))
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!student?.id) {
      navigate('/vote')
    }
  }, [navigate, student])

  useEffect(() => {
    const loadCandidates = async () => {
      setIsLoadingCandidates(true)
      setCandidateError('')

      try {
        const snapshot = await getDocs(collection(db, 'candidates'))
        const groupedCandidates = Object.fromEntries(candidatePositions.map((position) => [position, []]))

        snapshot.docs.forEach((candidateDoc) => {
          const data = candidateDoc.data()

          if (!groupedCandidates[data.position]) {
            return
          }

          groupedCandidates[data.position].push({
            id: candidateDoc.id,
            name: data.name ?? 'Unnamed Candidate',
            imageUrl: data.imageUrl ?? '',
          })
        })

        candidatePositions.forEach((position) => {
          groupedCandidates[position].sort((first, second) => first.name.localeCompare(second.name))
        })

        setCandidatesByPosition(groupedCandidates)
      } catch (loadError) {
        console.error('Failed to load candidates:', loadError)
        setCandidateError('Could not load candidates right now.')
      } finally {
        setIsLoadingCandidates(false)
      }
    }

    loadCandidates()
  }, [])

  const handleSubmitVote = async () => {
    setSubmitError('')

    if (!student?.id) {
      navigate('/vote')
      return
    }

    const requiredPositions = visiblePositions

    if (requiredPositions.length === 0) {
      setSubmitError('Voting is not open yet. No candidates have been added.')
      return
    }

    const missingPositions = requiredPositions.filter((position) => !selectedCandidates[position])

    if (missingPositions.length > 0) {
      setSubmitError('Select one candidate for every available position before submitting.')
      return
    }

    setIsSubmittingVote(true)

    try {
      const submitVote = httpsCallable(functions, 'submitVote')
      await submitVote({
        fullName: student.name,
        studentId: student.studentId,
        selections: requiredPositions.reduce((accumulator, position) => ({
          ...accumulator,
          [position]: selectedCandidates[position],
        }), {}),
      })
      navigate('/')
    } catch (voteError) {
      console.error('Failed to submit vote:', voteError)
      setSubmitError(voteError.message || 'Could not submit vote right now. Please try again.')
    } finally {
      setIsSubmittingVote(false)
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-12 pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-center gap-2 mb-4 mt-5">
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            Live
          </span>
          <span className="text-gray-600">-</span>
          <span className="text-lg font-medium text-gray-800">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1 text-center">Cast Your Vote</h1>
        <p className="text-base text-gray-600 mb-8 text-center">
          Select one candidate for each available position
        </p>

        {candidateError && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
            {candidateError}
          </p>
        )}

        {submitError && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
            {submitError}
          </p>
        )}

        {isLoadingCandidates && (
          <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
            Loading candidates...
          </div>
        )}

        {!isLoadingCandidates && visiblePositions.length === 0 && (
          <div className="mb-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600 text-center">
            Voting is not open yet. No candidates have been added.
          </div>
        )}

        {!isLoadingCandidates && visiblePositions.length > 0 && (
        <div className="space-y-8">
          {visiblePositions.map((position) => {
            const positionCandidates = candidatesByPosition[position] ?? []

            return (
            <div key={position}>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 title-underline">
                  {position}
                </h2>
                <div className="h-1 w-16 bg-indigo-600 rounded-full mt-1.5"></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {positionCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    onClick={() => handleSelectCandidate(position, candidate.id)}
                    className={`cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 ${
                      selectedCandidates[position] === candidate.id
                        ? 'ring-3 ring-indigo-600 shadow-lg'
                        : 'shadow-sm hover:shadow-md'
                    } bg-white border border-gray-200`}
                  >
                    <div className="p-3">
                      <div className="mb-2 flex justify-center">
                        <img
                          src={candidate.imageUrl}
                          alt={candidate.name}
                          className="w-20 h-20 rounded-full object-cover border-3 border-indigo-100"
                        />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-900 text-center mb-1 line-clamp-2">
                        {candidate.name}
                      </h3>
                      <button
                        className={`w-full rounded-xl py-1.5 px-2 text-xs font-semibold transition-all ${
                          selectedCandidates[position] === candidate.id
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                      >
                        {selectedCandidates[position] === candidate.id
                          ? '✓'
                          : 'Select'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )})}
        </div>
        )}

        <div className="mt-12 flex justify-center">
          <button
            onClick={handleSubmitVote}
            disabled={isLoadingCandidates || isSubmittingVote || visiblePositions.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-10 rounded-3xl text-base transition duration-300 shadow-lg disabled:opacity-70"
          >
            {isSubmittingVote ? 'Submitting...' : 'Submit Vote'}
          </button>
        </div>
      </div>

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

export default VotePage
