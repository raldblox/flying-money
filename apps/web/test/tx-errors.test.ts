import { type BaseError, ContractFunctionExecutionError, InternalRpcError, TransactionExecutionError } from 'viem'
import { describe, expect, it } from 'vitest'
import { txErrorMessage } from '../lib/tx-errors'

// A wallet error must be shown as what it is. The real reason is often buried several causes deep (MetaMask wraps
// it as "Internal JSON-RPC error" with the reason in `data`); an empty revert is not an RPC problem either.
const wrap = (inner: Error) =>
  new ContractFunctionExecutionError(new TransactionExecutionError(inner as BaseError, {} as never), {
    abi: [],
    functionName: 'approve',
    args: [],
  } as never)

describe('wallet errors say what actually happened', () => {
  it('digs out the reason a wallet hid inside "Internal JSON-RPC error"', () => {
    const rpc = new InternalRpcError(
      Object.assign(new Error('Internal JSON-RPC error.'), {
        data: { message: 'nonce too low: next nonce 8, tx nonce 7' },
      }),
    )
    const m = txErrorMessage(wrap(rpc))
    expect(m).toMatch(/nonce/i)
    expect(m).not.toMatch(/RPC in your wallet|public one/i)
  })

  it('names the common causes in plain words', () => {
    expect(txErrorMessage(new Error('User rejected the request.'))).toMatch(/rejected/i)
    expect(txErrorMessage(wrap(new InternalRpcError(new Error('insufficient funds for gas * price + value'))))).toMatch(
      /ETH for gas/i,
    )
    expect(
      txErrorMessage(new Error('The current chain of the wallet (id: 1) does not match the target chain')),
    ).toMatch(/another network/i)
  })

  it('an empty revert is reported as a refusal, never as an RPC problem', () => {
    const m = txErrorMessage(new Error('The contract function "approve" reverted with the following reason:\n'))
    expect(m).not.toMatch(/RPC/i)
    expect(m).toMatch(/refused|reason/i)
  })

  it('passes through anything else as is', () => {
    expect(txErrorMessage(new Error('replacement transaction underpriced'))).toMatch(
      /replacement transaction underpriced/,
    )
  })
})
