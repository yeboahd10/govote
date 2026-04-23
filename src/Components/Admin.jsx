import React, { useCallback, useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { useNavigate } from 'react-router-dom'
import { auth, db, functions, storage } from '../firebase'
import { candidatePositions } from '../constants/candidates'
import { buildResultsByPosition, getTotalVotesForResults } from '../utils/voting'
import { isUserAdmin } from '../utils/adminAuth'
import { normalizeName, normalizeStudentId } from '../utils/students'

const Admin = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [votingStatus, setVotingStatus] = useState('active')
  const [students, setStudents] = useState([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSavingStudent, setIsSavingStudent] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentId, setNewStudentId] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState('')
  const [editStudentName, setEditStudentName] = useState('')
  const [editStudentId, setEditStudentId] = useState('')
  const [voterMessage, setVoterMessage] = useState('')
  const [candidates, setCandidates] = useState([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false)
  const [candidateMessage, setCandidateMessage] = useState('')
  const [isSavingCandidate, setIsSavingCandidate] = useState(false)
  const [isDeletingCandidate, setIsDeletingCandidate] = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [candidatePosition, setCandidatePosition] = useState(candidatePositions[0])
  const [candidatePhoto, setCandidatePhoto] = useState(null)
  const [editingCandidateId, setEditingCandidateId] = useState('')
  const [editingCandidateImageUrl, setEditingCandidateImageUrl] = useState('')
  const [voterPage, setVoterPage] = useState(1)
  const [results, setResults] = useState({})
  const [votes, setVotes] = useState([])
  const [resultsMessage, setResultsMessage] = useState('')
  const [isResettingVotes, setIsResettingVotes] = useState(false)

  const votersPerPage = 10
  const totalVoterPages = Math.max(1, Math.ceil(students.length / votersPerPage))
  const paginatedStudents = students.slice((voterPage - 1) * votersPerPage, voterPage * votersPerPage)

  const stats = {
    totalVotes: getTotalVotesForResults(results, votes),
    activeVoters: students.length,
    totalCandidates: candidates.length,
    positions: candidatePositions.length,
  }

  const toggleVoting = () => {
    setVotingStatus(votingStatus === 'active' ? 'paused' : 'active')
  }

  const loadStudents = useCallback(async () => {
    setIsLoadingStudents(true)
    setVoterMessage('')

    try {
      const snapshot = await getDocs(collection(db, 'students'))
      const studentRows = snapshot.docs.map((studentDoc) => {
        const data = studentDoc.data()
        return {
          id: studentDoc.id,
          name: data.name ?? '',
          studentId: data.studentId ?? '',
          status: data.status ?? 'Not Voted',
        }
      })

      studentRows.sort((a, b) => a.name.localeCompare(b.name))
      setStudents(studentRows)
      setVoterPage(1)
    } catch (studentsError) {
      console.error('Failed to load students:', studentsError)
      setVoterMessage('Could not load students from Firestore.')
    } finally {
      setIsLoadingStudents(false)
    }
  }, [])

  const loadCandidates = useCallback(async () => {
    setIsLoadingCandidates(true)
    setCandidateMessage('')

    try {
      const snapshot = await getDocs(collection(db, 'candidates'))
      const candidateRows = snapshot.docs.map((candidateDoc) => {
        const data = candidateDoc.data()

        return {
          id: candidateDoc.id,
          name: data.name ?? '',
          position: data.position ?? '',
          imageUrl: data.imageUrl ?? '',
        }
      })

      candidateRows.sort((first, second) => {
        const positionDelta = candidatePositions.indexOf(first.position) - candidatePositions.indexOf(second.position)
        if (positionDelta !== 0) {
          return positionDelta
        }

        return first.name.localeCompare(second.name)
      })

      setCandidates(candidateRows)
      return candidateRows
    } catch (candidatesError) {
      console.error('Failed to load candidates:', candidatesError)
      setCandidateMessage('Could not load candidates from Firestore.')
      return []
    } finally {
      setIsLoadingCandidates(false)
    }
  }, [])

  const loadResults = useCallback(async (candidateSource) => {
    setResultsMessage('')

    try {
      const voteSnapshot = await getDocs(collection(db, 'votes'))
      const voteRows = voteSnapshot.docs.map((voteDoc) => voteDoc.data())
      const candidateRows = candidateSource && candidateSource.length > 0 ? candidateSource : await loadCandidates()

      setVotes(voteRows)
      setResults(buildResultsByPosition(candidateRows, voteRows))
    } catch (loadError) {
      console.error('Failed to load voting results:', loadError)
      setResultsMessage('Could not load results from Firestore.')
    }
  }, [loadCandidates])

  useEffect(() => {
    const loadInitialData = async () => {
      await auth.authStateReady()
      const adminAllowed = await isUserAdmin(auth.currentUser)

      if (!adminAllowed) {
        navigate('/')
        return
      }

      const candidateRows = await loadCandidates()
      await Promise.all([loadStudents(), loadResults(candidateRows)])
    }

    loadInitialData()
  }, [loadCandidates, loadResults, loadStudents, navigate])

  useEffect(() => {
    if (activeTab === 'voters') {
      loadStudents()
    }

    if (activeTab === 'candidates') {
      loadCandidates()
    }

    if (activeTab === 'results') {
      loadResults()
    }
  }, [activeTab, loadCandidates, loadResults, loadStudents])

  const closeCandidateModal = () => {
    setIsCandidateModalOpen(false)
    setEditingCandidateId('')
    setEditingCandidateImageUrl('')
    setCandidateName('')
    setCandidatePosition(candidatePositions[0])
    setCandidatePhoto(null)
  }

  const openEditCandidateModal = (candidate) => {
    setEditingCandidateId(candidate.id)
    setEditingCandidateImageUrl(candidate.imageUrl ?? '')
    setCandidateName(candidate.name)
    setCandidatePosition(candidate.position)
    setCandidatePhoto(null)
    setIsCandidateModalOpen(true)
  }

  const handleSaveCandidate = async (e) => {
    e.preventDefault()
    setCandidateMessage('')

    const fullName = candidateName.trim()
    const isEditingCandidate = Boolean(editingCandidateId)

    if (!fullName || !candidatePosition || (!isEditingCandidate && !candidatePhoto)) {
      setCandidateMessage('Enter full name, choose a position, and select a picture for new candidates.')
      return
    }

    setIsSavingCandidate(true)

    try {
      let nextImageUrl = editingCandidateImageUrl
      let nextImagePath

      if (candidatePhoto) {
        const safeFileName = `${Date.now()}-${candidatePhoto.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`
        const imageRef = ref(storage, `candidates/${safeFileName}`)
        await uploadBytes(imageRef, candidatePhoto)
        nextImageUrl = await getDownloadURL(imageRef)
        nextImagePath = imageRef.fullPath
      }

      if (isEditingCandidate) {
        const updatePayload = {
          name: fullName,
          position: candidatePosition,
          updatedAt: serverTimestamp(),
        }

        if (nextImageUrl) {
          updatePayload.imageUrl = nextImageUrl
        }

        if (nextImagePath) {
          updatePayload.imagePath = nextImagePath
        }

        await updateDoc(doc(db, 'candidates', editingCandidateId), updatePayload)
        setCandidateMessage('Candidate updated successfully.')
      } else {
        await addDoc(collection(db, 'candidates'), {
          name: fullName,
          position: candidatePosition,
          imageUrl: nextImageUrl,
          imagePath: nextImagePath ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        setCandidateMessage('Candidate added successfully.')
      }

      closeCandidateModal()
      await loadCandidates()
    } catch (saveCandidateError) {
      console.error('Failed to save candidate:', saveCandidateError)
      setCandidateMessage('Failed to save candidate. Check Firebase Storage and Firestore permissions.')
    } finally {
      setIsSavingCandidate(false)
    }
  }

  const handleDeleteCandidate = async () => {
    if (!editingCandidateId || isDeletingCandidate) {
      return
    }

    const confirmed = window.confirm('Are you sure you want to delete this candidate?')

    if (!confirmed) {
      return
    }

    setCandidateMessage('')
    setIsDeletingCandidate(true)

    try {
      await deleteDoc(doc(db, 'candidates', editingCandidateId))
      closeCandidateModal()
      setCandidateMessage('Candidate deleted successfully.')
      await loadCandidates()
    } catch (deleteCandidateError) {
      console.error('Failed to delete candidate:', deleteCandidateError)
      setCandidateMessage('Failed to delete candidate. Check Firebase permissions.')
    } finally {
      setIsDeletingCandidate(false)
    }
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    setVoterMessage('')

    const name = newStudentName.trim()
    const studentId = newStudentId.trim()

    if (!name || !studentId) {
      setVoterMessage('Please enter both student name and ID.')
      return
    }

    setIsSavingStudent(true)

    try {
      const normalizedName = normalizeName(name)
      const normalizedId = normalizeStudentId(studentId)

      await addDoc(collection(db, 'students'), {
        name,
        studentId: normalizedId,
        nameNormalized: normalizedName,
        studentIdNormalized: normalizedId,
        status: 'Not Voted',
        hasVoted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setIsAddModalOpen(false)
      setNewStudentName('')
      setNewStudentId('')
      setVoterMessage('Student added successfully.')
      await loadStudents()
    } catch (addError) {
      console.error('Failed to add student:', addError)
      setVoterMessage('Failed to add student. Check Firebase permissions.')
    } finally {
      setIsSavingStudent(false)
    }
  }

  const openEditModal = (student) => {
    setEditingStudentId(student.id)
    setEditStudentName(student.name)
    setEditStudentId(student.studentId)
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingStudentId('')
    setEditStudentName('')
    setEditStudentId('')
  }

  const handleUpdateStudent = async (e) => {
    e.preventDefault()
    setVoterMessage('')

    const name = editStudentName.trim()
    const studentId = editStudentId.trim()

    if (!name || !studentId || !editingStudentId) {
      setVoterMessage('Please enter both student name and ID.')
      return
    }

    setIsUpdatingStudent(true)

    try {
      const normalizedName = normalizeName(name)
      const normalizedId = normalizeStudentId(studentId)

      const duplicateIdQuery = query(
        collection(db, 'students'),
        where('studentIdNormalized', '==', normalizedId),
        limit(5)
      )

      const duplicateSnapshot = await getDocs(duplicateIdQuery)
      const conflictingRecord = duplicateSnapshot.docs.find((studentDoc) => studentDoc.id !== editingStudentId)

      if (conflictingRecord) {
        setVoterMessage('This student ID already belongs to another student. Use a unique ID.')
        return
      }

      await updateDoc(doc(db, 'students', editingStudentId), {
        name,
        studentId: normalizedId,
        nameNormalized: normalizedName,
        studentIdNormalized: normalizedId,
        updatedAt: serverTimestamp(),
      })

      closeEditModal()
      setVoterMessage('Student updated successfully.')
      await loadStudents()
    } catch (updateError) {
      console.error('Failed to update student:', updateError)
      setVoterMessage('Failed to update student. Check Firebase permissions.')
    } finally {
      setIsUpdatingStudent(false)
    }
  }

  const handleResetVoting = async () => {
    setResultsMessage('')
    setVoterMessage('')
    setIsResettingVotes(true)

    const resetFromClient = async () => {
      const [votesSnapshot, studentsSnapshot, browserLocksSnapshot] = await Promise.all([
        getDocs(collection(db, 'votes')),
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'browserVoteLocks')),
      ])

      let batch = writeBatch(db)
      let operations = 0
      const commits = []

      const queueCommit = async () => {
        if (operations >= 450) {
          commits.push(batch.commit())
          batch = writeBatch(db)
          operations = 0
        }
      }

      for (const voteDoc of votesSnapshot.docs) {
        batch.delete(voteDoc.ref)
        operations += 1
        await queueCommit()
      }

      for (const browserLockDoc of browserLocksSnapshot.docs) {
        batch.delete(browserLockDoc.ref)
        operations += 1
        await queueCommit()
      }

      for (const studentDoc of studentsSnapshot.docs) {
        batch.update(studentDoc.ref, {
          hasVoted: false,
          status: 'Not Voted',
          updatedAt: serverTimestamp(),
        })
        operations += 1
        await queueCommit()
      }

      if (operations > 0) {
        commits.push(batch.commit())
      }

      await Promise.all(commits)
    }

    try {
      if (!auth.currentUser) {
        setResultsMessage('Your admin session expired. Please log in again.')
        return
      }

      await auth.currentUser.getIdToken()

      const resetVoting = httpsCallable(functions, 'resetVoting')
      await resetVoting()
      setResultsMessage('Voting data reset successfully.')

      try {
        await Promise.all([loadStudents(), loadResults()])
      } catch (refreshError) {
        console.error('Voting reset succeeded, but refresh failed:', refreshError)
        setVoterMessage('Voting reset succeeded, but data refresh failed. Reload this page to sync tables.')
      }
    } catch (resetError) {
      console.error('Failed to reset voting:', resetError)

      const errorCode = String(resetError?.code || '').replace('functions/', '')

      if (errorCode === 'unauthenticated') {
        try {
          await resetFromClient()
          setResultsMessage('Voting data reset successfully.')
          await Promise.all([loadStudents(), loadResults()])
        } catch (fallbackError) {
          console.error('Client fallback reset failed:', fallbackError)
          setResultsMessage('Reset failed because backend auth is blocked and fallback reset was denied. Deploy updated Firestore rules and try again.')
        }
      } else if (errorCode === 'permission-denied') {
        try {
          await resetFromClient()
          setResultsMessage('Voting data reset successfully.')
          await Promise.all([loadStudents(), loadResults()])
        } catch (fallbackError) {
          console.error('Client fallback reset failed:', fallbackError)
          setResultsMessage('Your account is not allowed to reset via backend and fallback reset was denied. Verify admins/{uid} has active: true.')
        }
      } else if (errorCode === 'unavailable') {
        setResultsMessage('Reset service is temporarily unavailable. Please try again shortly.')
      } else {
        try {
          await resetFromClient()
          setResultsMessage('Voting data reset successfully.')
          await Promise.all([loadStudents(), loadResults()])
        } catch (fallbackError) {
          console.error('Client fallback reset failed:', fallbackError)
          setResultsMessage(resetError?.message || 'Failed to reset voting data.')
        }
      }
    } finally {
      setIsResettingVotes(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-3 sm:px-4 py-8 sm:py-10 pt-20 sm:pt-24">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 mt-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mt-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-600">Manage the voting system</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate('/live-feed')}
                className="px-4 py-2 text-sm sm:px-6 sm:py-2 sm:text-base rounded-xl sm:rounded-2xl font-semibold transition bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Open Live Feed
              </button>
              <div className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold ${
                votingStatus === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                Voting: {votingStatus === 'active' ? 'Active' : 'Paused'}
              </div>
              <button
                onClick={toggleVoting}
                className={`px-4 py-2 text-sm sm:px-6 sm:py-2 sm:text-base rounded-xl sm:rounded-2xl font-semibold transition ${
                  votingStatus === 'active'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {votingStatus === 'active' ? 'Pause Voting' : 'Resume Voting'}
              </button>
              <button
                onClick={handleResetVoting}
                disabled={isResettingVotes}
                className="px-4 py-2 text-sm sm:px-6 sm:py-2 sm:text-base rounded-xl sm:rounded-2xl font-semibold transition bg-gray-900 hover:bg-black text-white disabled:opacity-70"
              >
                {isResettingVotes ? 'Resetting...' : 'Reset Voting'}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'results', label: 'Results', icon: '📈' },
              { id: 'candidates', label: 'Candidates', icon: '👥' },
              { id: 'voters', label: 'Voters', icon: '🗳️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6">
          {activeTab === 'dashboard' && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Overview</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-indigo-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">🗳️</div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalVotes}</p>
                  <p className="text-xs sm:text-base text-gray-600">Total Votes</p>
                </div>
                <div className="bg-green-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">👥</div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.activeVoters}</p>
                  <p className="text-xs sm:text-base text-gray-600">Active Voters</p>
                </div>
                <div className="bg-blue-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">👤</div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.totalCandidates}</p>
                  <p className="text-xs sm:text-base text-gray-600">Candidates</p>
                </div>
                <div className="bg-purple-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">🏢</div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900">{stats.positions}</p>
                  <p className="text-xs sm:text-base text-gray-600">Positions</p>
                </div>
              </div>

            
            </div>
          )}

          {activeTab === 'results' && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Voting Results</h2>

              {resultsMessage && (
                <p className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {resultsMessage}
                </p>
              )}

              <div className="space-y-6">
                {Object.entries(results).map(([position, candidates]) => (
                  <div key={position} className="border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">{position}</h3>
                    {candidates.length === 0 ? (
                      <p className="text-sm text-gray-600">No candidates or votes for this position yet.</p>
                    ) : (
                    <div className="space-y-3">
                      {candidates.map((candidate, index) => (
                        <div key={candidate.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-400">#{index + 1}</span>
                            <span className="font-semibold text-gray-900">{candidate.name}</span>
                          </div>
                          <span className="font-bold text-indigo-600">{candidate.votes} votes</span>
                        </div>
                      ))}
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'candidates' && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Manage Candidates</h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm sm:text-base text-gray-600">Total candidates: {candidates.length}</p>
                  <button
                    onClick={() => setIsCandidateModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl sm:rounded-2xl font-semibold transition text-sm sm:text-base"
                  >
                  Add New Candidate
                  </button>
                </div>

                {candidateMessage && (
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    {candidateMessage}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {isLoadingCandidates && (
                    <div className="border border-gray-200 rounded-xl sm:rounded-2xl p-4 text-sm text-gray-600 bg-gray-50">
                      Loading candidates...
                    </div>
                  )}

                  {!isLoadingCandidates && candidates.length === 0 && (
                    <div className="border border-dashed border-gray-300 rounded-xl sm:rounded-2xl p-5 text-sm text-gray-600 bg-gray-50 md:col-span-2 lg:col-span-3">
                      No candidates added yet.
                    </div>
                  )}

                  {!isLoadingCandidates && candidates.map((candidate) => (
                    <div key={candidate.id} className="border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={candidate.imageUrl}
                          alt={candidate.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">{candidate.name}</p>
                          <p className="text-sm text-gray-600">{candidate.position}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => openEditCandidateModal(candidate)}
                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>

                {isCandidateModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                        {editingCandidateId ? 'Edit Candidate' : 'Add Candidate'}
                      </h3>
                      <p className="text-sm text-gray-600 mb-6">
                        {editingCandidateId
                          ? 'Update candidate details. Upload a new picture only if you want to replace the current one.'
                          : 'Add a candidate with a position and profile picture.'}
                      </p>

                      <form className="space-y-4" onSubmit={handleSaveCandidate}>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="candidate-name">
                            Full Name
                          </label>
                          <input
                            id="candidate-name"
                            type="text"
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                            placeholder="Enter full name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="candidate-position">
                            Position
                          </label>
                          <select
                            id="candidate-position"
                            value={candidatePosition}
                            onChange={(e) => setCandidatePosition(e.target.value)}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                          >
                            {candidatePositions.map((position) => (
                              <option key={position} value={position}>{position}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="candidate-photo">
                            {editingCandidateId ? 'Picture (Optional)' : 'Picture'}
                          </label>
                          {editingCandidateId && editingCandidateImageUrl && (
                            <img
                              src={editingCandidateImageUrl}
                              alt="Current candidate"
                              className="w-16 h-16 rounded-full object-cover mb-3"
                            />
                          )}
                          <input
                            id="candidate-photo"
                            type="file"
                            accept="image/*"
                            onChange={(e) => setCandidatePhoto(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          {editingCandidateId && (
                            <button
                              type="button"
                              onClick={handleDeleteCandidate}
                              disabled={isDeletingCandidate || isSavingCandidate}
                              className="px-5 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-70"
                            >
                              {isDeletingCandidate ? 'Deleting...' : 'Delete Candidate'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={closeCandidateModal}
                            disabled={isDeletingCandidate || isSavingCandidate}
                            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingCandidate || isDeletingCandidate}
                            className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-70"
                          >
                            {isSavingCandidate ? 'Saving...' : editingCandidateId ? 'Save Changes' : 'Save Candidate'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'voters' && (
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Voter Management</h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm sm:text-base text-gray-600">Total registered voters: {students.length}</p>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold transition disabled:opacity-70"
                    >
                      Add Student
                    </button>
                    <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold transition">
                      Export Voter List
                    </button>
                  </div>
                </div>

                {voterMessage && (
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                    {voterMessage}
                  </p>
                )}

                <div className="border border-gray-200 rounded-2xl sm:rounded-3xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Name</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">ID</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Status</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {isLoadingStudents && (
                        <tr>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600" colSpan={4}>Loading students...</td>
                        </tr>
                      )}

                      {!isLoadingStudents && students.length === 0 && (
                        <tr>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600" colSpan={4}>No students found in Firestore.</td>
                        </tr>
                      )}

                      {!isLoadingStudents && paginatedStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{student.name}</td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{student.studentId}</td>
                          <td className="px-4 sm:px-6 py-4 text-sm">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                              {student.status}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm">
                            <button
                              onClick={() => openEditModal(student)}
                              className="text-indigo-600 hover:text-indigo-800"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>

                {!isLoadingStudents && students.length > 0 && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">
                      Showing {(voterPage - 1) * votersPerPage + 1} to {Math.min(voterPage * votersPerPage, students.length)} of {students.length} voters
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVoterPage((prev) => Math.max(1, prev - 1))}
                        disabled={voterPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {voterPage} of {totalVoterPages}
                      </span>
                      <button
                        onClick={() => setVoterPage((prev) => Math.min(totalVoterPages, prev + 1))}
                        disabled={voterPage === totalVoterPages}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {isAddModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Add Student</h3>
                      <p className="text-sm text-gray-600 mb-6">Enter student name and ID to save to Firestore.</p>

                      <form className="space-y-4" onSubmit={handleAddStudent}>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="student-name">
                            Student Name
                          </label>
                          <input
                            id="student-name"
                            type="text"
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                            placeholder="Enter full name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="student-id">
                            Student ID
                          </label>
                          <input
                            id="student-id"
                            type="text"
                            value={newStudentId}
                            onChange={(e) => setNewStudentId(e.target.value)}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                            placeholder="Enter student ID"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddModalOpen(false)
                              setNewStudentName('')
                              setNewStudentId('')
                            }}
                            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingStudent}
                            className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-70"
                          >
                            {isSavingStudent ? 'Saving...' : 'Save Student'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {isEditModalOpen && (
                  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4">
                    <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Edit Student</h3>
                      <p className="text-sm text-gray-600 mb-6">Update student name and ID, then save to Firestore.</p>

                      <form className="space-y-4" onSubmit={handleUpdateStudent}>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="edit-student-name">
                            Student Name
                          </label>
                          <input
                            id="edit-student-name"
                            type="text"
                            value={editStudentName}
                            onChange={(e) => setEditStudentName(e.target.value)}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                            placeholder="Enter full name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="edit-student-id">
                            Student ID
                          </label>
                          <input
                            id="edit-student-id"
                            type="text"
                            value={editStudentId}
                            onChange={(e) => setEditStudentId(e.target.value)}
                            className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
                            placeholder="Enter student ID"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={closeEditModal}
                            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isUpdatingStudent}
                            className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-70"
                          >
                            {isUpdatingStudent ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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

export default Admin
