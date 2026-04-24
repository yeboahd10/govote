import React, { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { buildResultsByPosition, createEmptyResults } from '../utils/voting'

const LiveData = () => {
  const [results, setResults] = useState(createEmptyResults())
  const [isLoadingResults, setIsLoadingResults] = useState(true)
  const [resultsError, setResultsError] = useState('')

  useEffect(() => {
    const loadResults = async () => {
      setIsLoadingResults(true)
      setResultsError('')

      try {
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
  }, [])

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
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 px-3 py-8 pt-20 sm:px-4 sm:py-12 sm:pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center sm:mb-12">
          <div className="mt-6 mb-2 flex items-center justify-center gap-2 sm:mt-5 sm:mb-3 sm:gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-semibold text-green-600">LIVE</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-4xl">Live Voting Results</h1>
          <p className="text-sm text-gray-600 sm:text-lg">Real-time vote tracking for all positions</p>
        </div>

        {resultsError && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
            {resultsError}
          </p>
        )}

        {isLoadingResults ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600 shadow-lg sm:rounded-3xl sm:px-6 sm:py-12">
            Loading live results...
          </div>
        ) : (

        <div className="space-y-5 sm:space-y-8">
          {Object.entries(results).map(([position, candidates]) => {
            if (candidates.length === 0) {
              return (
                <div key={position} className="overflow-hidden rounded-2xl bg-white shadow-lg sm:rounded-3xl">
                  <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-4 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold text-white sm:text-2xl">{position}</h2>
                      <div className="text-right">
                        <p className="text-indigo-100 text-sm">Total Votes</p>
                        <p className="text-2xl font-bold text-white sm:text-3xl">0</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 text-sm text-gray-600 sm:p-6">No candidates or votes recorded for this position yet.</div>
                </div>
              )
            }

            const total = getTotalVotes(candidates)
            const leader = getLeader(candidates)
            const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes)

            return (
              <div key={position} className="overflow-hidden rounded-2xl bg-white shadow-lg sm:rounded-3xl">
                <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-white sm:text-2xl">{position}</h2>
                    <div className="text-right">
                      <p className="text-indigo-100 text-sm">Total Votes</p>
                      <p className="text-2xl font-bold text-white sm:text-3xl">{total}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4 sm:space-y-4 sm:p-6">
                  {sortedCandidates.map((candidate, index) => {
                    const percentage = getPercentage(candidate.votes, total)
                    const isLeader = candidate.id === leader.id

                    return (
                      <div key={candidate.id} className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                            <div className="w-6 text-sm font-bold text-gray-400 sm:w-8 sm:text-lg">#{index + 1}</div>
                            <div>
                              <p className={`text-sm font-semibold sm:text-base ${isLeader ? 'text-indigo-600' : 'text-gray-900'}`}>
                                {candidate.name}
                              </p>
                              {isLeader && (
                                <p className="text-xs text-indigo-600 font-semibold">🏆 Leading</p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-gray-900 sm:text-base">{candidate.votes} votes</p>
                            <p className="text-sm font-semibold text-indigo-600">{percentage}%</p>
                          </div>
                        </div>

                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 sm:h-3">
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
