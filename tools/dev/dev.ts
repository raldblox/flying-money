// `pnpm dev`: everything for local development in one command, with one log.
//   1. builds the workspace packages once (cached), then rebuilds them as you edit (turbo watch)
//   2. the site on http://localhost:3000, also reachable from a phone on the same Wi-Fi
//   3. the demo seller (Silk Road Oracle) on http://localhost:8787, announced on the local network (mDNS), with its
//      own records (never the hosted demo seller's)
// Flags: --https (camera and microphone on a phone need it; self-signed), --no-oracle, --no-watch, --port <n>.
// Ctrl+C stops everything.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const args = process.argv.slice(2)
const flag = (f: string) => args.includes(f)
const https = flag('--https')
const portArg = args.indexOf('--port')
const isWin = process.platform === 'win32'

const colour = { pkgs: 90, web: 36, oracle: 33, dev: 35 } as const
const tag = (name: keyof typeof colour) => `\x1b[${colour[name]}m${name.padEnd(6)}\x1b[0m│ `
const say = (s: string) => console.log(`${tag('dev')}${s}`)

/** The first Wi-Fi or Ethernet address a phone on the same network can reach. */
function lanAddress(): string | undefined {
  const all = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address)
  return all.find((a) => /^(192\.168|10)\./.test(a)) ?? all.find((a) => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) ?? all[0]
}

function portFree(port: number): Promise<boolean> {
  return new Promise((ok) => {
    const s = createServer()
      .once('error', () => ok(false))
      .once('listening', () => s.close(() => ok(true)))
    s.listen(port, '0.0.0.0')
  })
}
async function freePort(from: number): Promise<number> {
  for (let p = from; p < from + 20; p++) if (await portFree(p)) return p
  throw new Error(`no free port from ${from}`)
}

const children: ChildProcess[] = []
function run(
  name: keyof typeof colour,
  cmd: string,
  cmdArgs: string[],
  env: Record<string, string> = {},
  onLine?: (line: string) => void,
) {
  const childEnv = { ...process.env, FORCE_COLOR: '1', ...env }
  // pnpm is a .cmd on Windows, which needs a shell: give it one command line (our arguments have no spaces)
  const child = isWin
    ? spawn([cmd, ...cmdArgs].join(' '), { cwd: root, env: childEnv, shell: true })
    : spawn(cmd, cmdArgs, { cwd: root, env: childEnv })
  const pipe = (stream: NodeJS.ReadableStream | null) => {
    let rest = ''
    stream?.on('data', (d: Buffer) => {
      const lines = (rest + d.toString()).split(/\r?\n/)
      rest = lines.pop() ?? ''
      for (const l of lines) {
        if (!l.trim()) continue
        console.log(tag(name) + l)
        onLine?.(l)
      }
    })
  }
  pipe(child.stdout)
  pipe(child.stderr)
  child.on('exit', (code) => {
    if (!stopping) say(`${name} stopped${code ? ` (exit ${code})` : ''}`)
  })
  children.push(child)
  return child
}

let stopping = false
function stopAll() {
  if (stopping) return
  stopping = true
  say('stopping…')
  for (const c of children) {
    if (!c.pid || c.exitCode !== null) continue
    // the children start their own children (next, tsx): stop the whole tree
    if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' })
    else c.kill('SIGTERM')
  }
  setTimeout(() => process.exit(0), 500)
}
process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)

/** Only for the "is PAYEE_ADDRESS set?" check: the apps read .env themselves. */
function loadDotEnv(): Record<string, string | undefined> {
  const p = join(root, '.env')
  if (!existsSync(p)) return {}
  try {
    process.loadEnvFile(p)
  } catch {
    // a malformed .env is reported by the apps that read it
  }
  return process.env
}

async function main() {
  if (!existsSync(join(root, '.env')))
    say('no .env yet: the site runs, but the live demos need keys. Copy .env.example to .env and fill it in.')

  say('building the workspace packages (cached after the first time)…')
  const build = spawnSync('pnpm turbo run build --filter=./packages/* --output-logs=errors-only', {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  })
  if (build.status !== 0) {
    say('the package build failed: fix the error above and run `pnpm dev` again.')
    process.exit(1)
  }

  const lan = lanAddress()
  const webPort = portArg >= 0 ? Number(args[portArg + 1]) : await freePort(3000)
  const scheme = https ? 'https' : 'http'
  const env = loadDotEnv()

  let oracleUrl: string | undefined
  let shown = false
  const banner = () => {
    if (shown) return
    shown = true
    const line = '─'.repeat(64)
    console.log(`\n${line}`)
    say(`site         ${scheme}://localhost:${webPort}`)
    if (lan)
      say(
        `on a phone   ${scheme}://${lan}:${webPort}   (same Wi-Fi${https ? '; accept the self-signed certificate' : '; camera and mic need pnpm dev:https'})`,
      )
    if (oracleUrl) say(`demo seller  ${oracleUrl}/v1/tea-price?city=Luoyang   (announced on the local network)`)
    say('an agent     FM_OWNER=0x… FM_ALLOW_LAN=1 node packages/mcp/dist/bin.js call fm_discover')
    say('stop         Ctrl+C')
    console.log(`${line}\n`)
  }

  if (!flag('--no-watch'))
    run('pkgs', 'pnpm', ['turbo', 'watch', 'build', '--filter=./packages/*', '--output-logs=new-only'])

  if (!flag('--no-oracle')) {
    if (!env.PAYEE_ADDRESS) say('the demo seller needs PAYEE_ADDRESS in .env: skipping it (--no-oracle hides this).')
    else if (!(await portFree(8787))) say('port 8787 is busy: is a demo seller already running? Skipping it.')
    else {
      run('oracle', 'pnpm', ['--filter', '@flying-money/oracle', 'dev'], {
        ORACLE_ANNOUNCE: '1',
        PORT: '8787',
        // its own records: never the hosted demo seller's (same store, different keys)
        FM_REDIS_PREFIX: env.FM_REDIS_PREFIX ?? 'fm:v1:dev:',
      })
      oracleUrl = 'http://localhost:8787'
    }
  }

  run(
    'web',
    'pnpm',
    [
      '--filter',
      '@flying-money/web',
      'exec',
      'next',
      'dev',
      '--hostname',
      '0.0.0.0',
      '--port',
      String(webPort),
      ...(https ? ['--experimental-https'] : []),
    ],
    // let a phone on the same Wi-Fi load the dev site (next.config.ts reads this into allowedDevOrigins)
    lan ? { FM_DEV_ORIGINS: lan } : {},
    (l) => {
      if (/Ready in/.test(l)) banner()
    },
  )
}

main().catch((e) => {
  say((e as Error).message)
  stopAll()
})
