// Secret scan for `pnpm verify` (BUILD_SPEC §21.1): gitleaks if installed, plus this scanner, which always runs.
// Scans tracked and untracked, non-ignored files for private keys and API tokens. Never prints a secret value.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip|gz|mp4|webm|wasm)$/i
const SKIP = [/^pnpm-lock\.yaml$/, /^contracts\/lib\//]

// Values of secret-looking entries in the local .env: none of them may appear in any file.
function localSecrets(): Array<{ name: string; value: string }> {
  const p = join(root, '.env')
  if (!existsSync(p)) return []
  const out: Array<{ name: string; value: string }> = []
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|MNEMONIC)[A-Z0-9_]*)=([^#\s]+)/.exec(line)
    if (m && m[2]!.length >= 16) out.push({ name: m[1]!, value: m[2]!.replace(/^0x/i, '').toLowerCase() })
  }
  return out
}

const PATTERNS: Array<[string, RegExp]> = [
  [
    'private key assignment',
    /(?:private[_ ]?key|secret|mnemonic|[A-Z_]+_KEY)\s*[:=]\s*['"`]?(?:0x)?[0-9a-fA-F]{64}\b/i,
  ],
  ['PEM private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  [
    'Upstash/Vercel token assignment',
    /(?:KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|VERCEL_TOKEN|CRON_SECRET)\s*[:=]\s*['"`]?[A-Za-z0-9_=-]{20,}/,
  ],
]

export function scanSecrets(): string[] {
  const findings: string[] = []
  const gl = spawnSync('gitleaks', ['version'], { encoding: 'utf8' })
  if (gl.status === 0) {
    const r = spawnSync('gitleaks', ['detect', '--no-git', '--redact', '--source', root, '--no-banner'], {
      encoding: 'utf8',
    })
    if (r.status !== 0) findings.push(`gitleaks reported findings:\n${r.stdout}${r.stderr}`)
  }
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !BINARY.test(f) && !SKIP.some((s) => s.test(f)))
  const env = localSecrets()
  for (const f of files) {
    const p = join(root, f)
    let text: string
    try {
      if (!statSync(p).isFile() || statSync(p).size > 5_000_000) continue
      text = readFileSync(p, 'utf8')
    } catch {
      continue
    }
    const lower = text.toLowerCase()
    for (const s of env) if (lower.includes(s.value)) findings.push(`${f}: contains the value of ${s.name} from .env`)
    text.split('\n').forEach((line, i) => {
      for (const [name, re] of PATTERNS) if (re.test(line)) findings.push(`${f}:${i + 1}: ${name}`)
    })
  }
  return findings
}

if (process.argv[1]?.endsWith('secrets.ts')) {
  const f = scanSecrets()
  if (f.length) {
    console.error(`secret scan: ${f.length} finding(s)\n${f.join('\n')}`)
    process.exit(1)
  }
  console.log('secret scan: clean')
}
