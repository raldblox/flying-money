/**
 * Every way a slip can travel, for the site's copy. A slip is about 150 bytes and checks the same whichever way it
 * arrives; the frame format (docs/site/protocol.md, "Carriers") splits it for links that take less at a time.
 */
export interface CarrierInfo {
  name: string
  hint: string
}

/** Working today, at no cost: in the browser, the wallet and till, and the SDK. */
export const CARRIERS_NOW: CarrierInfo[] = [
  { name: 'QR code', hint: 'Shown on one screen, scanned by another camera. Works offline.' },
  { name: 'Sound', hint: 'Short chirps, heard by the other device’s microphone. Works offline.' },
  { name: 'Ultrasound', hint: 'The same, above what most people hear: for machines in a room.' },
  { name: 'AirDrop · Quick Share', hint: 'The phone’s share menu, device to device with no internet.' },
  { name: 'Link', hint: 'Opens the slip in Flying Money on any device.' },
  { name: 'File', hint: 'Saved and moved any way: USB, a memory card, a message.' },
  { name: 'Copy and paste', hint: 'Plain text, for anything else.' },
  { name: 'HTTP 402 · x402', hint: 'For APIs: the slip rides in a header with the request.' },
  { name: 'MCP', hint: 'For AI assistants: the MCP server pays with slips by itself.' },
  {
    name: 'Local network',
    hint: 'Sellers announce themselves on the Wi-Fi (mDNS); agents find and pay them, no internet.',
  },
]

/** Coming next: the slip format and its frames already fit them; each needs only its own adapter. */
export const CARRIERS_NEXT: CarrierInfo[] = [
  { name: 'Bluetooth LE', hint: 'Phones, robots and chargers, close range, no pairing for a payment.' },
  { name: 'NFC', hint: 'Tap to pay at a vending machine or a door.' },
  { name: 'MQTT', hint: 'Devices on a local broker publish an offer, a slip and a receipt.' },
  { name: 'ROS 2', hint: 'A payer node and a seller node for robots; keys never leave the node.' },
  { name: 'LoRa · mesh radio', hint: 'Drones and field devices, kilometres away, no internet at all.' },
]
