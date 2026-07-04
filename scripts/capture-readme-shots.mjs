// Captures the README screenshots from a running dev server using
// headless Chrome over the DevTools protocol. No npm dependencies:
// Node >= 21 ships a built-in WebSocket client.
//
// Usage: npm run dev (in another shell), then
//        node scripts/capture-readme-shots.mjs [baseUrl]

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_URL = process.argv[2] ?? 'http://127.0.0.1:4181/'
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/assets')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DEBUG_PORT = 9333

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${DEBUG_PORT}`,
  '--window-size=1600,900',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=/tmp/twin-shot-profile',
  BASE_URL,
])

async function getPageWebSocketUrl() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      const targets = await response.json()
      const page = targets.find((t) => t.type === 'page' && t.url.startsWith(BASE_URL))
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // chrome not ready yet
    }
    await sleep(250)
  }
  throw new Error('Could not reach Chrome DevTools endpoint')
}

let messageId = 0
const pending = new Map()

function send(ws, method, params = {}) {
  messageId += 1
  const id = messageId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolvePromise, rejectPromise) => {
    pending.set(id, { resolvePromise, rejectPromise })
  })
}

async function evaluate(ws, expression) {
  const { result } = await send(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
  })
  return result?.value
}

async function screenshot(ws, fileName) {
  const { data } = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  const path = resolve(OUT_DIR, fileName)
  writeFileSync(path, Buffer.from(data, 'base64'))
  console.log(`saved ${path}`)
}

async function main() {
  const wsUrl = await getPageWebSocketUrl()
  const ws = new WebSocket(wsUrl)
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolvePromise, rejectPromise } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) rejectPromise(new Error(message.error.message))
      else resolvePromise(message.result ?? {})
    }
  })
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))

  await send(ws, 'Page.enable')
  await send(ws, 'Runtime.enable')

  // wait until both bundled models are loaded and telemetry painted once
  for (let attempt = 0; attempt < 60; attempt++) {
    const modelCount = await evaluate(
      ws,
      'window.__twinScene ? window.__twinScene.ifcModels.size : 0',
    )
    if (modelCount >= 2) break
    await sleep(500)
  }
  await sleep(4000) // settle camera fit + first telemetry paint

  await screenshot(ws, 'ops-overview.png')

  // click into the 3D view to select a building element, then open Item tab
  const candidates = [
    [330, 420], [600, 520], [500, 350], [700, 470], [880, 490], [420, 300],
  ]
  for (const [x, y] of candidates) {
    await send(ws, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1,
    })
    await send(ws, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1,
    })
    await sleep(1200)
    const idle = await evaluate(
      ws,
      `document.body.textContent.includes('No item selected')`,
    )
    if (!idle) {
      console.log(`selected an item at (${x}, ${y})`)
      break
    }
  }
  await evaluate(
    ws,
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Item')?.click()`,
  )
  await sleep(1500)

  await screenshot(ws, 'item-selected.png')

  ws.close()
  chrome.kill()
}

main().catch((error) => {
  console.error(error)
  chrome.kill()
  process.exit(1)
})
