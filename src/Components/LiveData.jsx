import React, { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { isUserAdmin } from '../utils/adminAuth'
import { buildResultsByPosition, createEmptyResults } from '../utils/voting'

const LiveData = () => {
  const navigate = useNavigate()
  const [results, setResults] = useState(createEmptyResults())
  const [isLoadingResults, setIsLoadingResults] = useState(true)
  const [resultsError, setResultsError] = useState('')

  useEffect(() => {
    const loadResults = async () => {
      setIsLoadingResults(true)
      setResultsError('')

      try {
        await auth.authStateReady()
        const adminAllowed = await isUserAdmin(auth.currentUser)

        if (!adminAllowed) {
          navigate('/admin')
          return
        }

        const [candidatesSnapshot, votesSnapshot] = await Promise.all([
          getDocs(collection(db, 'candidates')),
          getDocs(collection(db, 'votes')),
        ])

        const candidates = candidatesSnapshot.docs.map((candidateDoc) => ({
          id: candidateDoc.id,
          ...candidateDoc.data(),
        }))
        const votes = votesSnapshot.docs.map((voteDoc) => voteDoc.data())

        setResults(buildResultsByPosition(candidates, votes))
      } catch (loadError) {
        console.error('Failed to load live results:', loadError)
        setResultsError('Could not load live results right now.')
      } finally {
        setIsLoadingResults(false)
      }
    }

    loadResults()
  }, [navigate])

  const getTotalVotes = (candidates) => {
    return candidates.reduce((sum, candidate) => sum + candidate.votes, 0)
  }

  const getPercentage = (votes, total) => {
    return total === 0 ? 0 : ((votes / total) * 100).toFixed(2)
  }

  const getLeader = (candidates) => {
    return candidates.reduce((max, candidate) =>
      candidate.votes > max.votes ? candidate : max
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 px-4 py-12 pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="flex items-center mt-5 justify-center gap-3 mb-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-semibold text-green-600">LIVE</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Live Voting Results</h1>
          <p className="text-lg text-gray-600">Real-time vote tracking for all positions</p>
        </div>

        {resultsError && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
            {resultsError}
          </p>
        )}

        {isLoadingResults ? (
          <div className="rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-600 shadow-lg">
            Loading live results...
          </div>
        ) : (

        <div className="space-y-8">
          {Object.entries(results).map(([position, candidates]) => {
            if (candidates.length === 0) {
              return (
                <div key={position} className="bg-white rounded-3xl shadow-lg overflow-hidden">
                  <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-white">{position}</h2>
                      <div className="text-right">
                        <p className="text-indigo-100 text-sm">Total Votes</p>
                        <p className="text-3xl font-bold text-white">0</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 text-sm text-gray-600">No candidates or votes recorded for this position yet.</div>
                </div>
              )
            }

            const total = getTotalVotes(candidates)
            const leader = getLeader(candidates)
            const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes)

            return (
              <div key={position} className="bg-white rounded-3xl shadow-lg overflow-hidden">
                <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">{position}</h2>
                    <div className="text-right">
                      <p className="text-indigo-100 text-sm">Total Votes</p>
                      <p className="text-3xl font-bold text-white">{total}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {sortedCandidates.map((candidate, index) => {
                    const percentage = getPercentage(candidate.votes, total)
                    const isLeader = candidate.id === leader.id

                    return (
                      <div key={candidate.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-bold text-gray-400 w-8">#{index + 1}</div>
                            <div>
                              <p className={`font-semibold ${isLeader ? 'text-indigo-600' : 'text-gray-900'}`}>
                                {candidate.name}
                              </p>
                              {isLeader && (
                                <p className="text-xs text-indigo-600 font-semibold">🏆 Leading</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{candidate.votes} votes</p>
                            <p className="text-sm font-semibold text-indigo-600">{percentage}%</p>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isLeader
                                ? 'bg-linear-to-r from-indigo-500 to-indigo-600'
                                : 'bg-linear-to-r from-gray-400 to-gray-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        )}

        <div className="mt-12 text-center text-sm text-gray-600">
          <p>Results reflect saved votes in Firestore.</p>
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

export default LiveData
