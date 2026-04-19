import React, { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { useNavigate } from 'react-router-dom'
import { functions } from '../firebase'

const Details = () => {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

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

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-start px-4 pt-24">
      <section className="w-full max-w-3xl mx-auto px-4 py-16" data-aos="fade-up">
        <div className="bg-white shadow-2xl border border-gray-200 rounded-3xl p-10" data-aos="zoom-in" data-aos-delay="200">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Voter Details</h2>
          <p className="text-gray-600 mb-8">
            Enter your full name and voter ID to begin the voting process.
          </p>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div data-aos="fade-right" data-aos-delay="400">
              <label htmlFor="full-name" className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="full-name"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-3xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-indigo-500 focus:ring-indigo-100 focus:outline-none focus:ring-2"
              />
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
