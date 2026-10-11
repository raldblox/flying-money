export async function storageHealth() {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.().catch(() => false) ?? false,
    storage?.estimate?.().catch(() => ({})) ?? {},
  ])
  return { supported: Boolean(storage), persisted, ...estimate }
}

/** Must be called from the user's explicit storage-protection action; grant is browser-controlled. */
export async function protectStorage(): Promise<boolean> {
  return navigator.storage?.persist?.().catch(() => false) ?? false
}
