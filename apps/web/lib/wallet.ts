import { openWalletRepository } from '@flying-money/browser/wallet'
import { loadCertificate } from './chain'

export {
  AddError,
  chainLabel,
  type HandOver,
  handOverFragment,
  parseHandOver,
  toCounterCert,
  type WalletEntry,
} from '@flying-money/browser/wallet'

let repository: Awaited<ReturnType<typeof openWalletRepository>> | undefined
export async function openWallet() {
  const opened = await openWalletRepository({ readCertificate: loadCertificate })
  repository = opened
  return async () => {
    await opened.release()
    if (repository === opened) repository = undefined
  }
}
const current = () => {
  if (!repository) throw new Error('Open the wallet before changing saved data.')
  return repository
}
export const initialize = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['initialize']>) =>
  current().initialize(...args)
export const confirmPayment = (
  ...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['confirmPayment']>
) => current().confirmPayment(...args)
export const walletStore = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['walletStore']>) =>
  current().walletStore(...args)
export const listEntries = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['listEntries']>) =>
  current().listEntries(...args)
export const hasPin = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['hasPin']>) =>
  current().hasPin(...args)
export const setPin = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['setPin']>) =>
  current().setPin(...args)
export const checkPin = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['checkPin']>) =>
  current().checkPin(...args)
export const addCertificate = (
  ...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['addCertificate']>
) => current().addCertificate(...args)
export const newDraftKey = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['newDraftKey']>) =>
  current().newDraftKey(...args)
export const listDrafts = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['listDrafts']>) =>
  current().listDrafts(...args)
export const draftKey = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['draftKey']>) =>
  current().draftKey(...args)
export const dropDraft = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['dropDraft']>) =>
  current().dropDraft(...args)
export const exportBackup = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['exportBackup']>) =>
  current().exportBackup(...args)
export const importBackup = (...args: Parameters<Awaited<ReturnType<typeof openWalletRepository>>['importBackup']>) =>
  current().importBackup(...args)
