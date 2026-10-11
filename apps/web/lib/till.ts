import './e2e'
import { openTill as openRuntimeTill } from '@flying-money/browser/till'
import { loadCertificate } from './chain'

export {
  DEFAULT_SETTINGS,
  holdLock,
  newOrderId,
  parsePriceList,
  type Till,
  TillBusyError,
  type TillSettings,
} from '@flying-money/browser/till'
export const openTill: typeof openRuntimeTill = (chain, payee, name, opts = {}) =>
  openRuntimeTill(chain, payee, name, {
    ...opts,
    background: opts.background ?? !opts.readCertificate,
    readCertificate: opts.readCertificate ?? ((_chainId, _contract, id) => loadCertificate(chain, id)),
  })
