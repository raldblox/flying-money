/** A transport acknowledgement means delivery only. It is not a seller receipt or settlement proof. */
export interface CarrierAdapter {
  send(payload: string, signal?: AbortSignal): Promise<'handed-off' | 'unacknowledged'>
}

/** Pin the already-persisted payload for every retry. This layer cannot sign or change an amount. */
export function preparedDelivery(payload: string) {
  if (!payload) throw new Error('A saved payment payload is required.')
  return {
    payload,
    async send(adapter: CarrierAdapter, signal?: AbortSignal) {
      signal?.throwIfAborted()
      return adapter.send(payload, signal)
    },
  }
}
