const baseUrl = process.env.ZHIWEN_BASE_URL || 'http://127.0.0.1:8787'

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const health = await request('/api/health')
assert(health.response.ok && health.body.ok, 'health check failed')

const unauthorized = await request('/api/wardrobe')
assert(unauthorized.response.status === 401, 'unauthorized wardrobe request should return 401')

const login = await request('/api/auth/demo', { method: 'POST' })
assert(login.response.ok && login.body.token, 'demo login failed')
const headers = { authorization: `Bearer ${login.body.token}`, 'content-type': 'application/json' }

const wardrobe = await request('/api/wardrobe', { headers })
assert(wardrobe.response.ok && wardrobe.body.items.length >= 8, 'wardrobe seed data is missing')

const outfits = await request('/api/outfits', { headers })
assert(outfits.response.ok && outfits.body.outfits.length >= 6, 'outfit seed data is missing')

const created = await request('/api/wardrobe', {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: `冒烟测试-${Date.now()}`, category: '上衣', color: '测试色', tint: '#cccccc', tags: ['测试'], visual: 'shirt' }),
})
assert(created.response.status === 201 && created.body.item?.id, 'wardrobe create failed')

const updated = await request(`/api/wardrobe/${created.body.item.id}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ status: '暂时不能穿' }),
})
assert(updated.response.ok && updated.body.item.status === '暂时不能穿', 'wardrobe update failed')

const deleted = await request(`/api/wardrobe/${created.body.item.id}`, { method: 'DELETE', headers })
assert(deleted.response.ok && deleted.body.deleted, 'wardrobe delete failed')

console.log(`API smoke test passed: ${baseUrl}`)
