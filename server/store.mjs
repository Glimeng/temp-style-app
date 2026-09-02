import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const dataFile = resolve(process.env.ZHIWEN_DATA_FILE || 'server/data/db.json')

const seedData = {
  users: [{ id: 1, nickname: '林', city: '北京', styles: ['简约', '通勤', '休闲'] }],
  wardrobes: {
    1: [
      { id: 1, name: '浅灰羊毛针织', category: '上衣', color: '浅灰', tint: '#d6d9d4', tags: ['保暖层', '针织', '简约'], status: '可穿', recognition: '已确认', visual: 'knit' },
      { id: 2, name: '米白打底T恤', category: '上衣', color: '米白', tint: '#f0ebe1', tags: ['贴身层', '纯色', '通勤'], status: '可穿', recognition: '已确认', visual: 'shirt' },
      { id: 3, name: '墨绿防风夹克', category: '外套', color: '墨绿', tint: '#3e5147', tags: ['防风', '防泼水', '防护层'], status: '可穿', recognition: '已确认', visual: 'coat' },
      { id: 4, name: '深灰直筒西裤', category: '裤子', color: '深灰', tint: '#5d6063', tags: ['梭织', '正式', '通勤'], status: '可穿', recognition: '已确认', visual: 'pants' },
      { id: 5, name: '奶油白运动鞋', category: '鞋子', color: '奶油白', tint: '#e9e3d7', tags: ['舒适', '日常'], status: '可穿', recognition: '已确认', visual: 'shoe' },
      { id: 6, name: '炭黑连帽卫衣', category: '上衣', color: '炭黑', tint: '#2b3035', tags: ['保暖层', '休闲', '加绒'], status: '暂时不能穿', recognition: '已确认', visual: 'knit' },
      { id: 7, name: '酒红格纹围巾', category: '配饰', color: '酒红', tint: '#7d3d48', tags: ['配饰', '复古'], status: '可穿', recognition: '已确认', visual: 'scarf' },
      { id: 8, name: '靛蓝牛仔裤', category: '裤子', color: '靛蓝', tint: '#334b62', tags: ['休闲', '直筒'], status: '可穿', recognition: '已确认', visual: 'pants' },
    ],
  },
  outfits: {
    1: [
      { id: 1, title: '轻暖通勤', note: '早晨保暖，午间可脱外层', level: '高适配', colors: ['#f0ebe1', '#d6d9d4', '#3e5147', '#5d6063'], items: [2, 1, 3, 4, 5], slots: [{ label: '早晨', value: '刚好 · 建议穿上防风层' }, { label: '办公室', value: '略冷 · 外套随手可取' }, { label: '晚间', value: '合适 · 风力增强时扣好外套' }], styles: ['简约', '通勤'] },
      { id: 2, title: '深色层次', note: '稳定、利落，适合正式工作', level: '高适配', colors: ['#2b3035', '#3e5147', '#334b62', '#e9e3d7'], items: [6, 3, 8, 5], slots: [{ label: '早晨', value: '刚好 · 卫衣提供基础保暖' }, { label: '办公室', value: '刚好 · 久坐可加围巾' }, { label: '晚间', value: '合适 · 防风夹克保持体感' }], styles: ['通勤', '休闲'] },
      { id: 3, title: '灰调轻盈', note: '室内活动友好，行动更轻松', level: '基本适配', colors: ['#d6d9d4', '#f0ebe1', '#334b62', '#e9e3d7'], items: [1, 2, 8, 5], slots: [{ label: '早晨', value: '略冷 · 建议加防风外层' }, { label: '办公室', value: '刚好 · 适合长时间室内' }, { label: '晚间', value: '略冷 · 返程前加外套' }], styles: ['简约', '休闲'] },
      { id: 4, title: '围巾点亮', note: '一件配饰让基础搭配更有层次', level: '基本适配', colors: ['#f0ebe1', '#7d3d48', '#3e5147', '#5d6063'], items: [2, 7, 3, 4, 5], slots: [{ label: '早晨', value: '刚好 · 围巾应对风感' }, { label: '办公室', value: '刚好 · 可取下围巾' }, { label: '晚间', value: '合适 · 适合步行返程' }], styles: ['通勤', '复古'] },
      { id: 5, title: '周末松弛', note: '低正式度，适合休闲外出', level: '需注意', colors: ['#f0ebe1', '#3e5147', '#334b62', '#e9e3d7'], items: [2, 3, 8, 5], slots: [{ label: '早晨', value: '略冷 · 活动前加一层' }, { label: '白天', value: '刚好 · 适合移动活动' }, { label: '晚间', value: '需注意 · 风大时保留外层' }], styles: ['休闲'] },
      { id: 6, title: '轻便日常', note: '轻量叠穿，适合城市步行', level: '基本适配', colors: ['#f0ebe1', '#d6d9d4', '#334b62', '#e9e3d7'], items: [2, 1, 8, 5], slots: [{ label: '早晨', value: '刚好 · 针织层应对微凉' }, { label: '办公室', value: '舒适 · 久坐无需增减' }, { label: '晚间', value: '合适 · 风大时加防风层' }], styles: ['简约', '日常'] },
    ],
  },
  feedback: [],
  worn: {},
}

let cache

async function ensureDataFile() {
  try {
    await readFile(dataFile, 'utf8')
  } catch {
    await mkdir(dirname(dataFile), { recursive: true })
    await writeFile(dataFile, JSON.stringify(seedData, null, 2), 'utf8')
  }
}

export async function loadStore() {
  if (!cache) {
    await ensureDataFile()
    cache = JSON.parse(await readFile(dataFile, 'utf8'))
  }
  return cache
}

export async function saveStore(next) {
  cache = next
  await mkdir(dirname(dataFile), { recursive: true })
  const temporaryFile = `${dataFile}.tmp`
  await writeFile(temporaryFile, JSON.stringify(cache, null, 2), 'utf8')
  await rename(temporaryFile, dataFile)
  return cache
}

export function cloneSeed() {
  return structuredClone(seedData)
}
