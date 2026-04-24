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

const buildDeviceFingerprintSeed = () => {
  if (typeof window === 'undefined') {
    return 'server'
  }

  const nav = window.navigator || {}
  const screenInfo = window.screen || {}
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'

  return [
    nav.platform || 'unknown-platform',
    nav.language || 'unknown-language',
    tz,
    screenInfo.width || 0,
    screenInfo.height || 0,
    screenInfo.colorDepth || 0,
    window.devicePixelRatio || 1,
    nav.hardwareConcurrency || 0,
    nav.maxTouchPoints || 0,
    nav.deviceMemory || 0,
  ].join('|')
}

const hashString = async (input) => {
  if (typeof window === 'undefined' || !window.crypto?.subtle || typeof TextEncoder === 'undefined') {
    return `fallback-${input}`
  }

  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const getDeviceFingerprint = async () => {
  const seed = buildDeviceFingerprintSeed()
  return hashString(seed)
}