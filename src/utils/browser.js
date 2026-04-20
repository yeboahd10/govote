const browserIdStorageKey = 'govote.browserId'

const createBrowserId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `browser-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export const getBrowserId = () => {
  if (typeof window === 'undefined') {
    return createBrowserId()
  }

  try {
    const existingBrowserId = window.localStorage.getItem(browserIdStorageKey)

    if (existingBrowserId) {
      return existingBrowserId
    }

    const nextBrowserId = createBrowserId()
    window.localStorage.setItem(browserIdStorageKey, nextBrowserId)
    return nextBrowserId
  } catch {
    return createBrowserId()
  }
}