'use client'
import { encode } from 'uqr'
import { buttonClass } from '@/components/section'

/** What the seller returned for the paid slip (the Oracle's /v1/certificate). */
export interface KeepsakeData {
  serial: string
  name: string
  issuedAt: string
  paid: string
  chainId: number
  certificateId: string
  proverb: { text: string; source: string }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max) {
      lines.push(line.trim())
      line = w
    } else line += ` ${w}`
  }
  if (line.trim()) lines.push(line.trim())
  return lines.slice(0, 4)
}

/** The keepsake as an SVG string: the same drawing on screen and in the downloaded file. */
export function keepsakeSvg(d: KeepsakeData, opts: { network: string; statusUrl: string }): string {
  const { data, size } = encode(opts.statusUrl, { ecc: 'M', border: 1 })
  const cell = 92 / size
  let qr = ''
  data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on)
        qr += `M${(x * cell).toFixed(2)} ${(y * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`
    })
  })
  const usd = (Number(d.paid) / 1e6).toFixed(2)
  const when = new Date(d.issuedAt).toUTCString().replace(/:\d\d GMT$/, ' UTC')
  const proverb = wrap(`“${d.proverb.text}”`, 46)
  const ink = '#1b1712'
  const seal = '#b7322c'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 840" width="600" height="840" font-family="Georgia, 'Times New Roman', serif">
<rect width="600" height="840" fill="#f4ede0"/>
<rect x="22" y="22" width="556" height="796" fill="none" stroke="${ink}" stroke-width="2"/>
<rect x="32" y="32" width="536" height="776" fill="none" stroke="${ink}" stroke-width="0.8"/>
<text x="300" y="118" text-anchor="middle" font-size="64" fill="${ink}" font-family="'Noto Serif SC', 'Songti SC', serif">飛錢</text>
<text x="300" y="156" text-anchor="middle" font-size="15" letter-spacing="6" fill="${ink}">FLYING MONEY</text>
<line x1="150" y1="180" x2="450" y2="180" stroke="${ink}" stroke-width="0.8"/>
<text x="300" y="214" text-anchor="middle" font-size="14" letter-spacing="3" fill="${seal}">CERTIFICATE Nº ${esc(d.serial)}</text>
<text x="300" y="276" text-anchor="middle" font-size="17" fill="${ink}">This certifies that</text>
<text x="300" y="318" text-anchor="middle" font-size="30" font-style="italic" fill="${ink}">${esc(d.name || 'the bearer of this slip')}</text>
<text x="300" y="362" text-anchor="middle" font-size="17" fill="${ink}">paid ${usd} USDC on ${esc(opts.network)}</text>
<text x="300" y="388" text-anchor="middle" font-size="17" fill="${ink}">with a signed payment slip,</text>
<text x="300" y="414" text-anchor="middle" font-size="17" fill="${ink}">and checked on the spot by the seller.</text>
${proverb.map((l, i) => `<text x="300" y="${484 + i * 26}" text-anchor="middle" font-size="18" font-style="italic" fill="${ink}">${esc(l)}</text>`).join('\n')}
<text x="300" y="${494 + proverb.length * 26}" text-anchor="middle" font-size="12" fill="#5d554a">${esc(d.proverb.source)}</text>
<g transform="translate(64 676)"><rect x="-6" y="-6" width="104" height="104" fill="#fbf7ef"/><path d="${qr}" fill="${ink}"/></g>
<text x="180" y="704" font-size="12" fill="#5d554a">Issued ${esc(when)}</text>
<text x="180" y="724" font-size="12" fill="#5d554a">Budget ${esc(d.certificateId.slice(0, 10))}…${esc(d.certificateId.slice(-6))}</text>
<text x="180" y="744" font-size="12" fill="#5d554a">Scan to check the budget on-chain.</text>
<text x="180" y="764" font-size="12" fill="#5d554a">Test network · test money</text>
<g transform="translate(486 724) rotate(-8)">
<circle r="52" fill="none" stroke="${seal}" stroke-width="4"/><circle r="44" fill="none" stroke="${seal}" stroke-width="1.5"/>
<text y="-4" text-anchor="middle" font-size="30" fill="${seal}" font-family="'Noto Serif SC', 'Songti SC', serif">飛錢</text>
<text y="24" text-anchor="middle" font-size="10" letter-spacing="2" fill="${seal}">PAID</text>
</g>
</svg>`
}

export function Keepsake({ data, network, statusUrl }: { data: KeepsakeData; network: string; statusUrl: string }) {
  const svg = keepsakeSvg(data, { network, statusUrl })
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const file = `flying-money-certificate-${data.serial}`

  const download = (href: string, name: string) => {
    const a = document.createElement('a')
    a.href = href
    a.download = name
    a.click()
  }
  const png = async () => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 1680
    c.getContext('2d')!.drawImage(img, 0, 0, 1200, 1680)
    download(c.toDataURL('image/png'), `${file}.png`)
  }

  return (
    <div className="grid gap-3">
      <img
        src={src}
        alt={`Your 飛錢 certificate number ${data.serial}${data.name ? ` for ${data.name}` : ''}`}
        width={600}
        height={840}
        className="mx-auto h-auto w-full max-w-md rounded shadow-sm"
      />
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className={buttonClass('primary')} onClick={() => void png()}>
          Save as image
        </button>
        <button type="button" className={buttonClass('secondary')} onClick={() => download(src, `${file}.svg`)}>
          Save as SVG
        </button>
      </div>
    </div>
  )
}
