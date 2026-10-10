export class LockBusyError extends Error {
  constructor() {
    super('This wallet or till is already open in another tab or window.')
  }
}

/** One owner of payment state. Unsupported browsers must never silently bypass this protection. */
export async function holdLock(name: string, attempts = 8): Promise<() => void> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new Error(
      'This browser cannot protect exclusive access to your wallet or till. Use a browser with Web Locks over HTTPS.',
    )
  }
  for (let i = 1; ; i++) {
    try {
      return await new Promise<() => void>((resolve, reject) => {
        let release = () => {}
        const held = new Promise<void>((done) => {
          release = done
        })
        void navigator.locks
          .request(name, { ifAvailable: true }, async (lock) => {
            if (!lock) {
              reject(new LockBusyError())
              return
            }
            resolve(release)
            await held
          })
          .catch(reject)
      })
    } catch (error) {
      if (!(error instanceof LockBusyError) || i >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
}
