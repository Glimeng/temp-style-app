import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { loadStore, saveStore } from './store.mjs'

const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const distRoot = resolve('dist')
const demoToken = 'demo-token'

const weather = {
  北京: { name: '北京', initial: 'B', temp: '16', weather: '晴间多云', summary: '12° - 21° · 早晚微凉', slots: ['12°', '21°', '15°'] },
  上海: { name: '上海', initial: 'S', temp: '24', weather: '多云', summary: '20° - 27° · 午间偏暖', slots: ['20°', '27°', '23°'] },
  广州: { name: '广州', initial: 'G', temp: '29', weather: '阵雨', summary: '26° - 31° · 潮湿闷热', slots: ['26°', '31°', '28°'] },
  深圳: { name: '深圳', initial: 'S', temp: '28', weather: '小雨', summary: '25° - 30° · 出门带伞', slots: ['25°', '30°', '27°'] },
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' })
  response.end(JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    let raw = ''
    request.on('data', (chunk) => { raw += chunk })
    request.on('end', () => {
      if (!raw) return resolveBody({})
      try { resolveBody(JSON.parse(raw)) } catch { reject(new Error('请求体必须是有效 JSON')) }
    })
    request.on('error', reject)
  })
}

function userIdFrom(request) {
  return request.headers.authorization === `Bearer ${demoToken}` ? 1 : null
}

function requireUser(request, response) {
  const userId = userIdFrom(request)
  if (!userId) sendJson(response, 401, { error: 'UNAUTHORIZED', message: '请先登录演示账号' })
  return userId
}

function routePath(url) {
  return new URL(url, 'http://localhost').pathname.split('/').filter(Boolean)
}

async function handleApi(request, response, parts) {
  const method = request.method || 'GET'
  if (method === 'OPTIONS') {
    response.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization' })
    return response.end()
  }
  if (parts[1] === 'health' && method === 'GET') return sendJson(response, 200, { ok: true, service: 'zhiwen-api', version: '0.1.0' })
  if (parts[1] === 'auth' && parts[2] === 'demo' && method === 'POST') {
    const store = await loadStore()
    return sendJson(response, 200, { token: demoToken, user: store.users[0] })
  }
  const userId = requireUser(request, response)
  if (!userId) return
  const store = await loadStore()
  if (parts[1] === 'me' && method === 'GET') return sendJson(response, 200, { user: store.users.find((user) => user.id === userId) })
  if (parts[1] === 'weather' && method === 'GET') {
    const city = new URL(request.url, 'http://localhost').searchParams.get('city') || '北京'
    return sendJson(response, 200, weather[city] || { name: city, initial: city.slice(0, 1), temp: '20', weather: '多云', summary: '16° - 24° · 演示天气数据', slots: ['16°', '24°', '20°'] })
  }
  if (parts[1] === 'wardrobe' && method === 'GET') return sendJson(response, 200, { items: store.wardrobes[userId] || [] })
  if (parts[1] === 'wardrobe' && method === 'POST') {
    const body = await readBody(request)
    if (!body.name || !body.category) return sendJson(response, 400, { error: 'VALIDATION_ERROR', message: '衣物名称和类别不能为空' })
    const items = store.wardrobes[userId] || []
    const item = { ...body, id: Math.max(0, ...items.map((entry) => entry.id)) + 1, recognition: body.recognition || '已确认', status: body.status || '可穿', tags: Array.isArray(body.tags) ? body.tags : [] }
    store.wardrobes[userId] = [...items, item]
    await saveStore(store)
    return sendJson(response, 201, { item })
  }
  if (parts[1] === 'wardrobe' && parts[2] && method === 'DELETE') {
    const itemId = Number(parts[2])
    const items = store.wardrobes[userId] || []
    const nextItems = items.filter((entry) => entry.id !== itemId)
    if (nextItems.length === items.length) return sendJson(response, 404, { error: 'NOT_FOUND', message: '衣物不存在' })
    store.wardrobes[userId] = nextItems
    await saveStore(store)
    return sendJson(response, 200, { deleted: true, id: itemId })
  }
  if (parts[1] === 'wardrobe' && parts[2] && method === 'PATCH') {
    const itemId = Number(parts[2])
    const items = store.wardrobes[userId] || []
    const index = items.findIndex((entry) => entry.id === itemId)
    if (index < 0) return sendJson(response, 404, { error: 'NOT_FOUND', message: '衣物不存在' })
    const body = await readBody(request)
    items[index] = { ...items[index], ...body, id: itemId }
    store.wardrobes[userId] = items
    await saveStore(store)
    return sendJson(response, 200, { item: items[index] })
  }
  if (parts[1] === 'outfits' && method === 'GET') return sendJson(response, 200, { outfits: store.outfits[userId] || [] })
  if (parts[1] === 'outfits' && parts[2] && parts[3] === 'wear' && method === 'POST') {
    const outfitId = Number(parts[2])
    const outfit = (store.outfits[userId] || []).find((entry) => entry.id === outfitId)
    if (!outfit) return sendJson(response, 404, { error: 'NOT_FOUND', message: '搭配不存在' })
    store.worn[userId] = { outfitId, date: new Date().toISOString() }
    await saveStore(store)
    return sendJson(response, 201, { worn: store.worn[userId] })
  }
  if (parts[1] === 'feedback' && method === 'POST') {
    const body = await readBody(request)
    if (!body.outfitId || !['偏冷', '刚好', '偏热'].includes(body.feeling)) return sendJson(response, 400, { error: 'VALIDATION_ERROR', message: '搭配和体感反馈不能为空' })
    const entry = { id: store.feedback.length + 1, userId, outfitId: Number(body.outfitId), feeling: body.feeling, createdAt: new Date().toISOString() }
    store.feedback.push(entry)
    await saveStore(store)
    return sendJson(response, 201, { feedback: entry })
  }
  return sendJson(response, 404, { error: 'NOT_FOUND', message: '接口不存在' })
}

async function serveStatic(request, response) {
  const requestPath = new URL(request.url, 'http://localhost').pathname
  const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1)
  const filePath = resolve(join(distRoot, normalize(relative)))
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) return sendJson(response, 403, { error: 'FORBIDDEN' })
  try {
    const body = await readFile(filePath)
    const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }
    const contentType = contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream'
    response.writeHead(200, { 'content-type': contentType })
    response.end(body)
  } catch {
    try {
      const body = await readFile(join(distRoot, 'index.html'))
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(body)
    } catch { sendJson(response, 404, { error: 'NOT_FOUND', message: '前端尚未构建，请运行 npm run build' }) }
  }
}

const server = createServer(async (request, response) => {
  try {
    const parts = routePath(request.url || '/')
    if (parts[0] === 'api') await handleApi(request, response, parts)
    else await serveStatic(request, response)
  } catch (error) {
    sendJson(response, 500, { error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : '服务器内部错误' })
  }
})

server.listen(port, host, () => console.log(`知温 API listening on http://${host}:${port}`))
