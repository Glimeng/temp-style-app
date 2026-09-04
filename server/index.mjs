import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { cloneSeed, loadStore, saveStore } from './store.mjs'

const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const distRoot = resolve('dist')
const demoToken = 'demo-token'
const demoResetKey = process.env.ZHIWEN_DEMO_RESET_KEY
const weatherCache = new Map()
const weatherCacheTtlMs = 10 * 60 * 1000

const weather = {
  北京: { name: '北京', initial: 'B', temp: '16', weather: '晴间多云', summary: '12° - 21° · 早晚微凉', slots: ['12°', '21°', '15°'] },
  上海: { name: '上海', initial: 'S', temp: '24', weather: '多云', summary: '20° - 27° · 午间偏暖', slots: ['20°', '27°', '23°'] },
  广州: { name: '广州', initial: 'G', temp: '29', weather: '阵雨', summary: '26° - 31° · 潮湿闷热', slots: ['26°', '31°', '28°'] },
  深圳: { name: '深圳', initial: 'S', temp: '28', weather: '小雨', summary: '25° - 30° · 出门带伞', slots: ['25°', '30°', '27°'] },
}

const weatherDescriptions = {
  0: '晴', 1: '大致晴朗', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪', 80: '阵雨', 81: '阵雨', 82: '强阵雨',
  95: '雷暴', 96: '冰雹雷暴', 99: '强冰雹雷暴',
}

function weatherDescription(code) {
  return weatherDescriptions[code] || '多云'
}

function windDirection(degrees) {
  const directions = ['北风', '东北风', '东风', '东南风', '南风', '西南风', '西风', '西北风']
  return directions[Math.round(((Number(degrees) % 360) + 360) / 45) % 8]
}

function roundedTemperature(value) {
  return String(Math.round(Number(value)))
}

function fallbackWeather(city) {
  const preset = weather[city]
  const fallback = preset || { name: city, initial: city.slice(0, 1), temp: '20', weather: '多云', summary: '16° - 24° · 天气服务暂不可用', slots: ['16°', '24°', '20°'] }
  return { ...fallback, apparentTemp: fallback.temp, humidity: 50, wind: '微风', isLive: false }
}

async function fetchJson(url) {
  const signal = AbortSignal.timeout(6000)
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`天气服务响应异常（${response.status}）`)
  return response.json()
}

async function lookupWeather(city, latitude, longitude) {
  const hasCoordinates = latitude !== null && latitude !== '' && longitude !== null && longitude !== ''
  let lat = hasCoordinates ? Number(latitude) : Number.NaN
  let lon = hasCoordinates ? Number(longitude) : Number.NaN
  const safeCity = String(city || '北京').trim().slice(0, 30) || '北京'
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search')
    geocodingUrl.searchParams.set('name', safeCity)
    geocodingUrl.searchParams.set('count', '1')
    geocodingUrl.searchParams.set('language', 'zh')
    geocodingUrl.searchParams.set('format', 'json')
    const geocoding = await fetchJson(geocodingUrl)
    const location = geocoding.results?.find((entry) => entry.country_code === 'CN') || geocoding.results?.[0]
    if (!location) throw new Error('未找到该城市')
    lat = location.latitude
    lon = location.longitude
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
  forecastUrl.searchParams.set('latitude', String(lat))
  forecastUrl.searchParams.set('longitude', String(lon))
  forecastUrl.searchParams.set('timezone', 'auto')
  forecastUrl.searchParams.set('forecast_days', '1')
  forecastUrl.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m')
  forecastUrl.searchParams.set('hourly', 'temperature_2m,weather_code')
  forecastUrl.searchParams.set('daily', 'temperature_2m_min,temperature_2m_max')
  const forecast = await fetchJson(forecastUrl)
  const current = forecast.current
  if (!current) throw new Error('未获取到当前天气')
  const hourly = forecast.hourly || { time: [], temperature_2m: [], weather_code: [] }
  const temperatureAt = (hour) => {
    const index = hourly.time.findIndex((time) => time.endsWith(`T${hour}:00`))
    return roundedTemperature(index >= 0 ? hourly.temperature_2m[index] : current.temperature_2m)
  }
  const min = roundedTemperature(forecast.daily?.temperature_2m_min?.[0] ?? current.temperature_2m)
  const max = roundedTemperature(forecast.daily?.temperature_2m_max?.[0] ?? current.temperature_2m)
  const description = weatherDescription(current.weather_code)
  return {
    name: safeCity,
    initial: safeCity.slice(0, 1),
    temp: roundedTemperature(current.temperature_2m),
    apparentTemp: roundedTemperature(current.apparent_temperature),
    weather: description,
    summary: `${min}° - ${max}° · ${description}`,
    slots: [`${temperatureAt('07')}°`, `${temperatureAt('12')}°`, `${temperatureAt('18')}°`],
    humidity: Number(current.relative_humidity_2m),
    wind: `${windDirection(current.wind_direction_10m)} ${Math.round(Number(current.wind_speed_10m))} km/h`,
    isLive: true,
    updatedAt: current.time,
  }
}

async function getWeather(city, latitude, longitude) {
  const cacheKey = [city || '北京', latitude || '', longitude || ''].join('|')
  const cached = weatherCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt < weatherCacheTtlMs) return cached.data
  const data = await lookupWeather(city, latitude, longitude)
  weatherCache.set(cacheKey, { createdAt: Date.now(), data })
  return data
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
  if (parts[1] === 'weather' && method === 'GET') {
    const query = new URL(request.url, 'http://localhost').searchParams
    const city = query.get('city') || '北京'
    try {
      return sendJson(response, 200, await getWeather(city, query.get('latitude'), query.get('longitude')))
    } catch {
      return sendJson(response, 200, fallbackWeather(city))
    }
  }
  if (parts[1] === 'auth' && parts[2] === 'demo' && method === 'POST') {
    const store = await loadStore()
    return sendJson(response, 200, { token: demoToken, user: store.users[0] })
  }
  if (parts[1] === 'demo' && parts[2] === 'reset' && method === 'POST') {
    if (!demoResetKey || request.headers['x-demo-reset-key'] !== demoResetKey) {
      return sendJson(response, 403, { error: 'FORBIDDEN', message: '演示数据重置密钥无效' })
    }
    await saveStore(cloneSeed())
    return sendJson(response, 200, { ok: true, message: '演示数据已恢复到标准状态' })
  }
  const userId = requireUser(request, response)
  if (!userId) return
  const store = await loadStore()
  if (parts[1] === 'me' && method === 'GET') return sendJson(response, 200, { user: store.users.find((user) => user.id === userId) })
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
