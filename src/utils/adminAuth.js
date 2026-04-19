import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const createAdminError = (code, details = {}) => {
  const error = new Error(code)
  error.code = code
  Object.assign(error, details)
  return error
}

export const isUserAdmin = async (user) => {
  if (!user) {
    return false
  }

  try {
    const adminSnapshot = await getDoc(doc(db, 'admins', user.uid))

    if (!adminSnapshot.exists()) {
      throw createAdminError('admin-profile-missing', { uid: user.uid, email: user.email ?? '' })
    }

    if (adminSnapshot.data().active === false) {
      throw createAdminError('admin-disabled', { uid: user.uid, email: user.email ?? '' })
    }

    return true
  } catch (error) {
    if (error.code === 'permission-denied') {
      throw createAdminError('admin-profile-read-denied', { uid: user.uid, email: user.email ?? '' })
    }

    throw error
  }
}

export const signInAdmin = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)

  try {
    await isUserAdmin(credential.user)
  } catch (error) {
    await signOut(auth)
    throw error
  }

  return credential.user
}

export const signOutAdmin = async () => {
  await signOut(auth)
}