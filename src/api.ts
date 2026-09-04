export type WardrobeItemDto = {
  id: number
  name: string
  category: '上衣' | '裤子' | '连衣裙' | '半身裙' | '短裙' | '外套' | '鞋子' | '配饰' | '包袋'
  color: string
  tint: string
  tags: string[]
  status: '可穿' | '暂时不能穿'
  recognition: '已确认' | '待确认'
  visual: 'shirt' | 'knit' | 'coat' | 'pants' | 'shoe' | 'scarf' | 'dress' | 'skirt' | 'bag'
  imageUrl?: string
}

export type OutfitDto = {
  id: number
  title: string
  note: string
  level: '高适配' | '基本适配' | '需注意'
  colors: string[]
  items: number[]
  slots: { label: string; value: string }[]
  styles: string[]
}

export type WeatherDto = {
  name: string
  initial: string
  temp: string
  apparentTemp: string
  weather: string
  summary: string
  slots: [string, string, string]
  humidity: number
  wind: string
  isLive: boolean
  updatedAt?: string
}

type ApiOptions = { method?: string; body?: unknown; token?: string | null }

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api${path}`, {
    method: options.method || 'GET',
    headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `请求失败（${response.status}）`)
  return payload as T
}

export function demoLogin() {
  return apiRequest<{ token: string; user: { id: number; nickname: string; city: string; styles: string[] } }>('/auth/demo', { method: 'POST' })
}

export function getWeather(city: string, coordinates?: { latitude: number; longitude: number }) {
  const query = new URLSearchParams({ city })
  if (coordinates) {
    query.set('latitude', String(coordinates.latitude))
    query.set('longitude', String(coordinates.longitude))
  }
  return apiRequest<WeatherDto>(`/weather?${query.toString()}`)
}

export function getWardrobe(token: string) {
  return apiRequest<{ items: WardrobeItemDto[] }>('/wardrobe', { token })
}

export function createWardrobeItem(token: string, item: Omit<WardrobeItemDto, 'id'>) {
  return apiRequest<{ item: WardrobeItemDto }>('/wardrobe', { method: 'POST', token, body: item })
}

export function updateWardrobeItem(token: string, id: number, changes: Partial<WardrobeItemDto>) {
  return apiRequest<{ item: WardrobeItemDto }>(`/wardrobe/${id}`, { method: 'PATCH', token, body: changes })
}

export function deleteWardrobeItem(token: string, id: number) {
  return apiRequest<{ deleted: boolean; id: number }>(`/wardrobe/${id}`, { method: 'DELETE', token })
}

export function getOutfits(token: string) {
  return apiRequest<{ outfits: OutfitDto[] }>('/outfits', { token })
}

export function markOutfitWorn(token: string, outfitId: number) {
  return apiRequest<{ worn: { outfitId: number; date: string } }>(`/outfits/${outfitId}/wear`, { method: 'POST', token })
}

export function saveOutfitFeedback(token: string, outfitId: number, feeling: '偏冷' | '刚好' | '偏热') {
  return apiRequest<{ feedback: { id: number; outfitId: number; feeling: string; createdAt: string } }>('/feedback', { method: 'POST', token, body: { outfitId, feeling } })
}
