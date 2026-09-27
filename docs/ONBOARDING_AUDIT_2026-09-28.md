# Onboarding audit: agents, shops, everyone else (28 Sep 2026)

**Method:** each first-time journey walked on the live site (useflyingmoney.vercel.app, phone width), plus the source of every step. The founder's brief: "introducing it to an agent is messy; shops are confusing; ordinary users too."

**Summary:** every audience meets the same problem. The site explains the *mechanism*, but no path starts from *what the person wants to do*, and each path assumes crypto tooling (a browser wallet, test ETH, a terminal, `.env` files, copying hex strings between people). Two defects are outright blockers.

## Blockers

| # | Finding | Evidence |
|---|---|---|
| B1 | **Nothing can be installed.** `@flying-money/client` and `@flying-money/mcp` are not on npm, and the GitHub repo is private. Every `npx @flying-money/…` instruction (docs, MCP config, assistant setup) fails for anyone outside this machine. | `npm view @flying-money/mcp` → not found; repo visibility PRIVATE |
| B2 | **A blank screen on phones.** `/app` without a browser wallet shows an empty placeholder indefinitely: the gate waits on a wallet reconnection that never finishes. There is no message and no way forward. | Phone screenshot of `/app`: 21 words, an empty card |

## Connecting an agent (owner + agent)

| # | Friction |
|---|---|
| G1 | **Five human hand-offs** between owner and agent: run `keygen` in a terminal, keep a `.env`, paste the agent's address into the app, copy a budget id back to the agent, edit its config. None of it is something the owner should do. |
| G2 | **No single instruction to give an agent.** `llms.txt` summarises the protocol; `/docs/agents` is SDK code for developers. Nothing says "agent: here is how to set yourself up". |
| G3 | **Two unrelated owner paths** (Fund an agent; People & agents → Add → Allow requests → copy `FM_OWNER_GRANT`) that never tell the agent anything. The owner carries values back and forth by hand. |
| G4 | **Retired words in the agent docs:** "Counting House", "certificate", "total so far", "gas". |

## Shops

| # | Friction |
|---|---|
| S1 | `/shop` opens on crypto questions: "Network", "Your shop's address (where collected money goes)", Connect wallet. The name is prefilled with the demo's "Lantern Café". |
| S2 | Two equal buttons afterwards ("Open the till", "Shop page and counter QR"), and a note that the till lives only in a link the shop must bookmark. Lose the link, lose the till. |
| S3 | **No answer to "how do customers get a budget for my shop?"** Only someone else can fund one, and the shop has nothing to hand them. The loop has no starting point. |
| S4 | Three similar names (`/shops` marketing, `/shop` tool, `/docs/shops`), and collecting needs a wallet holding ETH for the network fee. |

## Everyone else (giving, and receiving a budget)

| # | Friction |
|---|---|
| U1 | The landing page offers 20+ actions and no single "start here". Visitors must first classify themselves ("For AI agents / For families & shops"). |
| U2 | Giving needs a browser wallet holding test USDC and test ETH on a specific network, and the app doesn't say so until it fails (and on a phone it shows nothing, B2). |
| U3 | Two separate "apps" with no explanation of who uses which: the account (`/app`, for people who give and collect) and the wallet (`/wallet`, for people who received a budget). The header's "Open app" always goes to the account. |
| U4 | `/wallet` opened directly asks for a PIN to set up a wallet with nothing in it, without saying what it is for. |

## Fixes (specified in BUILD_SPEC §22.10)

1. **One sentence connects an agent.** The owner copies a prepared instruction: "Set up Flying Money payments for me. Read https://useflyingmoney.vercel.app/agent.md and follow it. My wallet is 0x…". `/agent.md` is written *for the agent*: add the MCP server (exact per client), and the server makes and keeps its own key on first run (no terminal for the human). It then tells the owner its address and asks for its first budget with a link. The owner's only steps are to open that link and approve (G1–G3).
2. **One start page** (`/start`, and "Get started" on the landing page and in the header): four plain choices, each leading to one guided path: *Give someone a budget · Let my AI assistant pay · Use a budget I was given · Take payments at my shop* (U1, U3).
3. **No dead ends without a wallet:** the account explains what a wallet is for, links phone wallets' in-app browsers, and points people who received a budget to their wallet instead (B2, U2). The wallet explains itself when empty (U4).
4. **Shops in three steps:** name → where the money goes → your till is ready. The till is remembered on this device, and the result screen includes a **"customers: get a budget for this shop" link and QR** that pre-fills the gift form for this shop (S1–S3).
5. **Agent docs rewritten** in the one vocabulary, pointing to `/agent.md` (G4).

**Needs the founder (B1):** publish `@flying-money/core`, `chains`, `client` and `mcp` to npm, and/or make the repo public. Until then the agent path works only on this machine.
