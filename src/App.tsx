import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, Bell, Check, ChevronRight, CloudRain, CloudSun, Compass, Heart, Home, MapPin, Plus, RefreshCw, Search, Shirt, Sparkles, Sun, Thermometer, Trash2, UserRound, Wind, X } from 'lucide-react'
import { createWardrobeItem, demoLogin, getOutfits, getWardrobe, markOutfitWorn, saveOutfitFeedback, updateWardrobeItem } from './api'
import './App.css'

type Tab = 'home' | 'wardrobe' | 'explore' | 'detail' | 'replace' | 'profile'
type Category = '全部' | '上衣' | '裤子' | '连衣裙' | '半身裙' | '外套' | '鞋子' | '配饰' | '包袋'
type Feedback = '偏冷' | '刚好' | '偏热' | null
type Item = { id: number; name: string; category: Exclude<Category, '全部'>; color: string; tint: string; tags: string[]; status: '可穿' | '暂时不能穿'; recognition: '已确认' | '待确认'; visual: 'shirt' | 'knit' | 'coat' | 'pants' | 'shoe' | 'scarf' | 'dress' | 'skirt' | 'bag'; imageUrl?: string }
type WardrobeFilters = { status: Item['status'] | '全部'; recognition: Item['recognition'] | '全部'; tag: string[] }
type Outfit = { id: number; title: string; note: string; level: '高适配' | '基本适配' | '需注意'; colors: string[]; items: number[]; slots: { label: string; value: string }[]; styles: string[] }
type City = { name: string; initial: string; temp: string; weather: string; summary: string; slots: [string, string, string] }
type UploadDraft = { source: string; preview: string }

const DEMO_TOKEN = 'demo-token'
const LOCAL_DEMO_TOKEN = 'local-demo-token'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('登录请求超时')), timeoutMs)
    promise.then((value) => {
      window.clearTimeout(timer)
      resolve(value)
    }).catch((error) => {
      window.clearTimeout(timer)
      reject(error)
    })
  })
}

const items: Item[] = [
  { id: 1, name: '浅灰羊毛针织', category: '上衣', color: '浅灰', tint: '#d6d9d4', tags: ['保暖层', '针织', '简约'], status: '可穿', recognition: '已确认', visual: 'knit' },
  { id: 2, name: '米白打底T恤', category: '上衣', color: '米白', tint: '#f0ebe1', tags: ['贴身层', '纯色', '通勤'], status: '可穿', recognition: '已确认', visual: 'shirt' },
  { id: 3, name: '墨绿防风夹克', category: '外套', color: '墨绿', tint: '#3e5147', tags: ['防风', '防泼水', '防护层'], status: '可穿', recognition: '已确认', visual: 'coat' },
  { id: 4, name: '深灰直筒西裤', category: '裤子', color: '深灰', tint: '#5d6063', tags: ['梭织', '正式', '通勤'], status: '可穿', recognition: '已确认', visual: 'pants' },
  { id: 5, name: '奶油白运动鞋', category: '鞋子', color: '奶油白', tint: '#e9e3d7', tags: ['舒适', '日常'], status: '可穿', recognition: '已确认', visual: 'shoe' },
  { id: 6, name: '炭黑连帽卫衣', category: '上衣', color: '炭黑', tint: '#2b3035', tags: ['保暖层', '休闲', '加绒'], status: '暂时不能穿', recognition: '已确认', visual: 'knit' },
  { id: 7, name: '酒红格纹围巾', category: '配饰', color: '酒红', tint: '#7d3d48', tags: ['配饰', '复古'], status: '可穿', recognition: '已确认', visual: 'scarf' },
  { id: 8, name: '靛蓝牛仔裤', category: '裤子', color: '靛蓝', tint: '#334b62', tags: ['休闲', '直筒'], status: '可穿', recognition: '已确认', visual: 'pants' },
]

const baseOutfits: Outfit[] = [
  { id: 1, title: '轻暖通勤', note: '早晨保暖，午间可脱外层', level: '高适配', colors: ['#f0ebe1', '#d6d9d4', '#3e5147', '#5d6063'], items: [2, 1, 3, 4, 5], slots: [{ label: '早晨', value: '刚好 · 建议穿上防风层' }, { label: '办公室', value: '略冷 · 外套随手可取' }, { label: '晚间', value: '合适 · 风力增强时扣好外套' }], styles: ['简约', '通勤'] },
  { id: 2, title: '深色层次', note: '稳定、利落，适合正式工作', level: '高适配', colors: ['#2b3035', '#3e5147', '#334b62', '#e9e3d7'], items: [6, 3, 8, 5], slots: [{ label: '早晨', value: '刚好 · 卫衣提供基础保暖' }, { label: '办公室', value: '刚好 · 久坐可加围巾' }, { label: '晚间', value: '合适 · 防风夹克保持体感' }], styles: ['通勤', '休闲'] },
  { id: 3, title: '灰调轻盈', note: '室内活动友好，行动更轻松', level: '基本适配', colors: ['#d6d9d4', '#f0ebe1', '#334b62', '#e9e3d7'], items: [1, 2, 8, 5], slots: [{ label: '早晨', value: '略冷 · 建议加防风外层' }, { label: '办公室', value: '刚好 · 适合长时间室内' }, { label: '晚间', value: '略冷 · 返程前加外套' }], styles: ['简约', '休闲'] },
  { id: 4, title: '围巾点亮', note: '一件配饰让基础搭配更有层次', level: '基本适配', colors: ['#f0ebe1', '#7d3d48', '#3e5147', '#5d6063'], items: [2, 7, 3, 4, 5], slots: [{ label: '早晨', value: '刚好 · 围巾应对风感' }, { label: '办公室', value: '刚好 · 可取下围巾' }, { label: '晚间', value: '合适 · 适合步行返程' }], styles: ['通勤', '复古'] },
  { id: 5, title: '周末松弛', note: '低正式度，适合休闲外出', level: '需注意', colors: ['#f0ebe1', '#3e5147', '#334b62', '#e9e3d7'], items: [2, 3, 8, 5], slots: [{ label: '早晨', value: '略冷 · 活动前加一层' }, { label: '白天', value: '刚好 · 适合移动活动' }, { label: '晚间', value: '需注意 · 风大时保留外层' }], styles: ['休闲'] },
  { id: 6, title: '轻便日常', note: '轻量叠穿，适合城市步行', level: '基本适配', colors: ['#f0ebe1', '#d6d9d4', '#334b62', '#e9e3d7'], items: [2, 1, 8, 5], slots: [{ label: '早晨', value: '刚好 · 针织层应对微凉' }, { label: '办公室', value: '舒适 · 久坐无需增减' }, { label: '晚间', value: '合适 · 风大时加防风层' }], styles: ['简约', '日常'] },
]
const categories: Category[] = ['全部', '上衣', '裤子', '连衣裙', '半身裙', '外套', '鞋子', '配饰', '包袋']
const cityOptions: City[] = [
  { name: '北京', initial: 'B', temp: '16', weather: '晴间多云', summary: '12° - 21° · 早晚微凉', slots: ['12°', '21°', '15°'] },
  { name: '上海', initial: 'S', temp: '24', weather: '多云', summary: '20° - 27° · 午间偏暖', slots: ['20°', '27°', '23°'] },
  { name: '广州', initial: 'G', temp: '29', weather: '阵雨', summary: '26° - 31° · 潮湿闷热', slots: ['26°', '31°', '28°'] },
  { name: '深圳', initial: 'S', temp: '28', weather: '小雨', summary: '25° - 30° · 出门带伞', slots: ['25°', '30°', '27°'] },
  { name: '成都', initial: 'C', temp: '22', weather: '阴', summary: '18° - 24° · 体感平稳', slots: ['18°', '24°', '21°'] },
  { name: '重庆', initial: 'C', temp: '25', weather: '小雨', summary: '22° - 28° · 湿度较高', slots: ['22°', '28°', '25°'] },
  { name: '长沙', initial: 'C', temp: '23', weather: '多云', summary: '19° - 26° · 午后舒适', slots: ['19°', '26°', '22°'] },
  { name: '杭州', initial: 'H', temp: '23', weather: '小雨', summary: '19° - 26° · 注意雨具', slots: ['19°', '26°', '22°'] },
  { name: '武汉', initial: 'W', temp: '21', weather: '晴', summary: '16° - 24° · 早晚舒适', slots: ['16°', '24°', '20°'] },
  { name: '西安', initial: 'X', temp: '18', weather: '晴', summary: '11° - 22° · 温差较大', slots: ['11°', '22°', '16°'] },
  { name: '南京', initial: 'N', temp: '22', weather: '多云', summary: '17° - 25° · 体感舒适', slots: ['17°', '25°', '21°'] },
  { name: '厦门', initial: 'X', temp: '27', weather: '晴', summary: '24° - 29° · 海风明显', slots: ['24°', '29°', '26°'] },
  { name: '昆明', initial: 'K', temp: '20', weather: '晴', summary: '14° - 23° · 紫外线强', slots: ['14°', '23°', '18°'] },
  { name: '海口', initial: 'H', temp: '29', weather: '雷阵雨', summary: '26° - 32° · 闷热有雨', slots: ['26°', '32°', '28°'] },
  { name: '沈阳', initial: 'S', temp: '9', weather: '晴', summary: '3° - 14° · 早晚偏冷', slots: ['3°', '14°', '8°'] },
  { name: '哈尔滨', initial: 'H', temp: '4', weather: '多云', summary: '-2° - 9° · 注意保暖', slots: ['-2°', '9°', '3°'] },
  { name: '乌鲁木齐', initial: 'W', temp: '10', weather: '晴', summary: '3° - 16° · 风力偏强', slots: ['3°', '16°', '9°'] },
  { name: '贵阳', initial: 'G', temp: '19', weather: '阴', summary: '15° - 22° · 湿冷', slots: ['15°', '22°', '18°'] },
  { name: '郑州', initial: 'Z', temp: '18', weather: '晴', summary: '12° - 23° · 风力适中', slots: ['12°', '23°', '17°'] },
  { name: '合肥', initial: 'H', temp: '21', weather: '多云', summary: '16° - 24° · 体感舒适', slots: ['16°', '24°', '20°'] },
]
const domesticCityDirectory: Record<string, string[]> = {
  A: ['安庆', '安阳', '安顺', '安康', '阿克苏', '阿勒泰', '阿坝', '阿拉善', '阿里'],
  B: ['保定', '包头', '巴彦淖尔', '滨州', '蚌埠', '亳州', '本溪', '白山', '白城', '百色', '北海', '毕节', '保山', '宝鸡', '巴中', '白银', '博尔塔拉'],
  C: ['沧州', '承德', '朝阳', '赤峰', '长春', '池州', '滁州', '潮州', '崇左', '昌都', '楚雄', '昌吉'],
  D: ['大连', '丹东', '大庆', '大兴安岭', '东营', '德州', '东莞', '儋州', '德阳', '达州', '迪庆', '大理', '定西'],
  E: ['鄂尔多斯', '鄂州', '恩施'],
  F: ['福州', '抚顺', '阜新', '阜阳', '佛山', '防城港'],
  G: ['桂林', '赣州', '贵港', '广安', '甘孜', '果洛', '固原', '甘南'],
  H: ['哈尔滨', '鹤岗', '黑河', '湖州', '淮北', '淮南', '黄山', '淮安', '菏泽', '鹤壁', '黄石', '黄冈', '衡阳', '怀化', '惠州', '河源', '贺州', '海南州', '海东', '海北', '黄南', '红河', '汉中', '河池', '哈密', '和田'],
  J: ['济南', '济宁', '嘉兴', '金华', '嘉峪关', '酒泉', '晋中', '晋城', '焦作', '济源', '荆州', '荆门', '景德镇', '九江', '吉安', '吉林', '佳木斯', '鸡西', '锦州'],
  K: ['开封', '克拉玛依', '喀什', '克孜勒苏'],
  L: ['兰州', '洛阳', '漯河', '聊城', '临沂', '丽水', '六安', '龙岩', '乐山', '泸州', '凉山', '丽江', '临沧', '拉萨', '林芝', '陇南', '临夏', '辽阳', '辽源', '来宾', '柳州'],
  M: ['马鞍山', '牡丹江', '梅州', '茂名', '眉山', '绵阳'],
  N: ['南通', '南昌', '南平', '宁德', '南阳', '南宁', '内江', '南充', '怒江', '那曲'],
  P: ['攀枝花', '平顶山', '濮阳', '萍乡', '莆田', '盘锦', '普洱', '平凉'],
  Q: ['青岛', '齐齐哈尔', '七台河', '泉州', '衢州', '潜江', '庆阳', '黔东南', '黔南', '黔西南', '钦州'],
  R: ['日照'],
  S: ['石家庄', '苏州', '宿迁', '绍兴', '三明', '上饶', '十堰', '随州', '神农架', '松原', '四平', '双鸭山', '绥化', '沈阳', '商丘', '三门峡', '三亚', '三沙', '遂宁', '山南', '石嘴山'],
  T: ['天津', '唐山', '太原', '通辽', '铁岭', '泰州', '台州', '铜陵', '天水', '吐鲁番', '塔城', '铜仁'],
  W: ['无锡', '温州', '芜湖', '潍坊', '威海', '乌海', '乌兰察布', '文山', '万宁', '五指山', '吴忠', '武威'],
  X: ['徐州', '宣城', '新余', '新乡', '许昌', '信阳', '襄阳', '孝感', '咸宁', '湘潭', '西双版纳'],
  Y: ['烟台', '宜昌', '宜宾', '雅安', '岳阳', '益阳', '永州', '玉林', '玉溪', '延安', '榆林', '银川', '伊春', '伊犁', '鹰潭', '阳江', '云浮', '营口'],
  Z: ['淄博', '枣庄', '张家口', '张家界', '株洲', '自贡', '资阳', '遵义', '昭通', '中卫', '舟山'],
}
const allDomesticCities: City[] = [
  ...cityOptions,
  ...Object.entries(domesticCityDirectory).flatMap(([initial, names]) => names.map((name): City => ({ name, initial, temp: '20', weather: '多云', summary: '16° - 24° · 演示天气数据', slots: ['16°', '24°', '20°'] }))),
].filter((city, index, all) => all.findIndex((entry) => entry.name === city.name) === index).sort((a, b) => a.initial.localeCompare(b.initial) || a.name.localeCompare(b.name, 'zh-CN'))

function ClothingVisual({ item, small = false }: { item: Item; small?: boolean }) {
  if (item.imageUrl) return <div className={`clothing-visual uploaded-visual ${small ? 'visual-small' : ''}`}><img src={item.imageUrl} alt={item.name} /></div>
  return <div className={`clothing-visual clothing-${item.visual} ${small ? 'visual-small' : ''}`} style={{ '--item-tint': item.tint } as CSSProperties}><div className="visual-shadow" /><div className="visual-shape" />{item.visual === 'coat' && <div className="visual-zip" />}{item.visual === 'shirt' && <div className="visual-neck" />}{item.visual === 'knit' && <div className="visual-stitch" />}</div>
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [returnTab, setReturnTab] = useState<Exclude<Tab, 'detail'>>('home')
  const [category, setCategory] = useState<Category>('全部')
  const [wardrobeSearch, setWardrobeSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<WardrobeFilters>({ status: '全部', recognition: '全部', tag: [] })
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit>(baseOutfits[0])
  const [replaceItemId, setReplaceItemId] = useState<number | null>(null)
  const [outfits, setOutfits] = useState(baseOutfits)
  const [wardrobeItems, setWardrobeItems] = useState<Item[]>(items)
  const [temp, setTemp] = useState('16')
  const [city, setCity] = useState<City>(cityOptions[0])
  const [cityHistory, setCityHistory] = useState<City[]>([cityOptions[0], cityOptions[9], cityOptions[1]])
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [feltTemp, setFeltTemp] = useState('体感 15°')
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [worn, setWorn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(window.localStorage.getItem('zhiwen-demo-token')))
  const [showUpload, setShowUpload] = useState(false)
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null)
  const [showGuide, setShowGuide] = useState(true)
  const [explore, setExplore] = useState(false)
  const [preferredStyles, setPreferredStyles] = useState<string[]>(['通勤', '简约', '日系'])
  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])
  const apiToken = () => window.localStorage.getItem('zhiwen-demo-token')
  useEffect(() => {
    const token = apiToken()
    if (!token || token === LOCAL_DEMO_TOKEN) return
    Promise.all([getWardrobe(token), getOutfits(token)]).then(([wardrobe, outfitData]) => {
      setWardrobeItems(wardrobe.items as Item[])
      setOutfits(outfitData.outfits as Outfit[])
    }).catch(() => {
      setIsLoggedIn(false)
      window.localStorage.removeItem('zhiwen-demo-token')
    })
  }, [])
  const availableTags = useMemo(() => Array.from(new Set(wardrobeItems.flatMap((item) => item.tags))).sort(), [wardrobeItems])
  const filteredItems = useMemo(() => wardrobeItems.filter((item) => (category === '全部' || item.category === category) && (!wardrobeSearch.trim() || `${item.name}${item.tags.join('')}${item.color}`.toLowerCase().includes(wardrobeSearch.trim().toLowerCase())) && (filters.status === '全部' || item.status === filters.status) && (filters.recognition === '全部' || item.recognition === filters.recognition) && (!filters.tag.length || filters.tag.some((tag) => item.tags.includes(tag)))), [category, filters, wardrobeItems, wardrobeSearch])
  const activeOutfits = useMemo(() => outfits.filter((outfit) => outfit.items.every((id) => wardrobeItems.find((item) => item.id === id)?.status === '可穿')).sort((a, b) => (Number(temp) < 13 && a.id === 1 ? -1 : 0) - (Number(temp) < 13 && b.id === 1 ? -1 : 0)), [outfits, temp, wardrobeItems])
  const recommendationStyles = preferredStyles
  const rankedOutfits = useMemo(() => [...activeOutfits].sort((a, b) => b.styles.filter((style) => recommendationStyles.includes(style)).length - a.styles.filter((style) => recommendationStyles.includes(style)).length || a.id - b.id), [activeOutfits, recommendationStyles])
  const openOutfit = (outfit: Outfit) => { if (tab !== 'detail') setReturnTab(tab); setSelectedOutfit(outfit); setTab('detail'); setNotice('') }
  const beginReplaceItem = (itemId: number) => { setReplaceItemId(itemId); setTab('replace'); setNotice('') }
  const replacementCandidates = useMemo(() => {
    if (replaceItemId === null) return []
    const currentItem = wardrobeItems.find((item) => item.id === replaceItemId)
    if (!currentItem) return []
    const remainingItems = selectedOutfit.items.filter((id) => id !== replaceItemId).map((id) => wardrobeItems.find((item) => item.id === id)).filter(Boolean) as Item[]
    const score = (candidate: Item) => {
      const sharedTags = remainingItems.reduce((total, item) => total + candidate.tags.filter((tag) => item.tags.includes(tag)).length, 0)
      const colorBonus = remainingItems.some((item) => item.color === candidate.color) ? 1 : 0
      return sharedTags * 3 + colorBonus
    }
    return wardrobeItems.filter((item) => item.category === currentItem.category && item.id !== currentItem.id && item.status === '可穿').sort((a, b) => score(b) - score(a) || a.id - b.id).map((item, index, list) => ({ item, score: list.length ? Math.max(78, 96 - index * 5 + score(item)) : 0 }))
  }, [replaceItemId, selectedOutfit.items, wardrobeItems])
  const applyReplacement = (candidateId: number) => {
    if (replaceItemId === null) return
    const candidate = wardrobeItems.find((item) => item.id === candidateId)
    if (!candidate) return
    setSelectedOutfit((current) => ({ ...current, items: current.items.map((id) => id === replaceItemId ? candidateId : id), colors: current.colors.map((color, index) => index === 0 ? candidate.tint : color) }))
    setReplaceItemId(null)
    setTab('detail')
    setNotice(`已将搭配中的单品替换为${candidate.name}`)
  }
  const wearOutfit = (outfit: Outfit) => { setSelectedOutfit(outfit); setWorn(true); setFeedback(null); const token = apiToken(); if (token) void markOutfitWorn(token, outfit.id).catch(() => undefined); setNotice(`已选“${outfit.title}”，出门后可在详情页反馈体感`) }
  const addClothing = () => { if (isLoggedIn) setShowUpload(true); else setShowLogin(true) }
  const handleUploadFile = (source: string, file: File) => { const preview = URL.createObjectURL(file); setShowUpload(false); setUploadDraft({ source, preview }) }
  const confirmUploadedItem = (item: Item) => { const token = apiToken(); const persist = token ? createWardrobeItem(token, item).then(({ item: saved }) => saved as Item).catch(() => item) : Promise.resolve(item); void persist.then((savedItem) => { setWardrobeItems((current) => [...current, savedItem]); const nextOutfitId = Math.max(...outfits.map((outfit) => outfit.id)) + 1; const companionItems = savedItem.category === '裤子' ? [2, 3, savedItem.id, 5] : savedItem.category === '鞋子' ? [2, 3, 4, savedItem.id] : savedItem.category === '连衣裙' ? [savedItem.id, 3, 5, 7] : savedItem.category === '半身裙' ? [2, savedItem.id, 3, 5] : savedItem.category === '包袋' ? [2, 3, 4, savedItem.id] : [savedItem.id, 3, 8, 5]; setOutfits((current) => [...current, { id: nextOutfitId, title: '新衣物组合', note: '刚加入衣橱，可继续调整', level: '基本适配', colors: [savedItem.tint, '#dce7df', '#3e5147', '#e9e3d7'], items: companionItems, slots: [{ label: '早晨', value: '刚好 · 建议按当前体感出门' }, { label: '办公室', value: '刚好 · 可根据空调温度增减' }, { label: '晚间', value: '合适 · 返程前查看风力变化' }], styles: ['待确认'] }]); setUploadDraft(null); setNotice('已确认并加入衣橱，新单品已参与搭配') }) }
  const toggleItemStatus = (itemId: number) => setWardrobeItems((current) => current.map((item) => { if (item.id !== itemId) return item; const nextStatus = item.status === '可穿' ? '暂时不能穿' : '可穿'; const token = apiToken(); if (token) void updateWardrobeItem(token, itemId, { status: nextStatus }).catch(() => undefined); return { ...item, status: nextStatus } }))
  const replaceOutfit = () => { const index = outfits.findIndex((outfit) => outfit.id === selectedOutfit.id); setSelectedOutfit(outfits[(index + 1) % outfits.length]); setNotice('已为你换了一套同等保暖度的组合') }
  const saveFeedback = (value: Feedback) => { setFeedback(value); if (value) { const token = apiToken(); if (token) void saveOutfitFeedback(token, selectedOutfit.id, value).catch(() => undefined); setNotice(value === '刚好' ? '已记录，知温会继续保持这类组合' : `已记录“${value}”，下次推荐会为你调整一档`) } }
  return <div className="app-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Thermometer size={17} /></div><span>知温</span></div><div className="top-actions"><button className="icon-btn" aria-label="通知"><Bell size={18} /></button><button className="avatar-btn" onClick={() => setTab('profile')}>林</button></div></header>
    <main className="page-content">{showCityPicker ? <CityPicker city={city} history={cityHistory} onBack={() => setShowCityPicker(false)} onSelect={(nextCity) => { setCity(nextCity); setCityHistory((history) => [nextCity, ...history.filter((entry) => entry.name !== nextCity.name)].slice(0, 4)); setTemp(nextCity.temp); setFeltTemp(`体感 ${Number(nextCity.temp) - 1}°`); setShowCityPicker(false); setNotice(`已切换至${nextCity.name}，推荐已按当地天气更新`) }} /> : <>{tab === 'home' && <HomePage city={city} temp={temp} setTemp={setTemp} feltTemp={feltTemp} setFeltTemp={setFeltTemp} explore={explore} setExplore={setExplore} activeOutfits={rankedOutfits} openOutfit={openOutfit} wearOutfit={wearOutfit} setShowCityPicker={setShowCityPicker} setShowLogin={setShowLogin} showGuide={showGuide} setShowGuide={setShowGuide} />}{tab === 'wardrobe' && <WardrobePage category={category} setCategory={setCategory} filteredItems={filteredItems} search={wardrobeSearch} setSearch={setWardrobeSearch} filters={filters} setFilters={setFilters} tags={availableTags} showFilters={showFilters} setShowFilters={setShowFilters} onAddClothing={addClothing} onToggleStatus={toggleItemStatus} setNotice={setNotice} />}{tab === 'explore' && <ExplorePage outfits={activeOutfits} preferredStyles={recommendationStyles} openOutfit={openOutfit} />}{tab === 'detail' && <DetailPage outfit={selectedOutfit} items={wardrobeItems} temp={temp} worn={worn} setWorn={setWorn} feedback={feedback} saveFeedback={saveFeedback} replaceOutfit={replaceOutfit} openOutfit={openOutfit} outfits={activeOutfits} onReplaceItem={beginReplaceItem} onBack={() => setTab(returnTab)} />}{tab === 'replace' && <ReplaceItemPage outfit={selectedOutfit} items={wardrobeItems} replaceItemId={replaceItemId} candidates={replacementCandidates} onBack={() => { setReplaceItemId(null); setTab('detail') }} onSelect={applyReplacement} />}{tab === 'profile' && <ProfilePage explore={explore} setExplore={setExplore} preferredStyles={preferredStyles} isLoggedIn={isLoggedIn} setShowLogin={setShowLogin} setNotice={setNotice} onOpenEditor={() => setShowProfileEditor(true)} />}</>}</main>
    {notice && <div className="toast"><Check size={15} />{notice}</div>}
    {!showCityPicker && <nav className="bottom-nav"><NavButton icon={<Home size={19} />} label="今日" active={tab === 'home'} onClick={() => setTab('home')} /><NavButton icon={<Shirt size={19} />} label="衣橱" active={tab === 'wardrobe'} onClick={() => setTab('wardrobe')} /><NavButton icon={<Compass size={19} />} label="探索" active={tab === 'explore'} onClick={() => setTab('explore')} /><NavButton icon={<UserRound size={19} />} label="我的" active={tab === 'profile'} onClick={() => setTab('profile')} /></nav>}
    {showLogin && <LoginSheet onClose={() => setShowLogin(false)} onLogin={async () => {
      // 先完成前端登录态，避免弹窗被网络请求卡住；账号资料随后再从接口同步。
      window.localStorage.setItem('zhiwen-demo-token', LOCAL_DEMO_TOKEN)
      setIsLoggedIn(true)
      setShowLogin(false)
      setShowGuide(false)
      setNotice('微信授权成功，已进入本地演示模式')

      try {
        const loginResult = await withTimeout(demoLogin(), 2500)
        const token = loginResult.token || DEMO_TOKEN
        window.localStorage.setItem('zhiwen-demo-token', token)
        setNotice('微信授权成功，已绑定当前账号')
        const [wardrobe, outfitData] = await Promise.all([getWardrobe(token), getOutfits(token)])
        setWardrobeItems(wardrobe.items as Item[])
        setOutfits(outfitData.outfits as Outfit[])
      } catch {
        // The demo can still be used with the bundled local wardrobe/outfits.
      }
    }} />}
    {showUpload && <UploadSheet onClose={() => setShowUpload(false)} onFileSelected={handleUploadFile} />}
    {uploadDraft && <UploadConfirmSheet draft={uploadDraft} onClose={() => { URL.revokeObjectURL(uploadDraft.preview); setUploadDraft(null) }} onConfirm={confirmUploadedItem} />}
    {showProfileEditor && <ProfileEditSheet styles={preferredStyles} onClose={() => setShowProfileEditor(false)} onSave={(styles) => { setPreferredStyles(styles); setShowProfileEditor(false); setNotice('风格偏好已保存，日常推荐和风格探索已更新') }} />}
  </div>
}

function NavButton({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button> }

function HomePage({ city, temp, setTemp, feltTemp, setFeltTemp, explore, setExplore, activeOutfits, openOutfit, wearOutfit, setShowCityPicker, setShowLogin, showGuide, setShowGuide }: { city: City; temp: string; setTemp: (v: string) => void; feltTemp: string; setFeltTemp: (v: string) => void; explore: boolean; setExplore: (v: boolean) => void; activeOutfits: Outfit[]; openOutfit: (outfit: Outfit) => void; wearOutfit: (outfit: Outfit) => void; setShowCityPicker: (v: boolean) => void; setShowLogin: (v: boolean) => void; showGuide: boolean; setShowGuide: (v: boolean) => void }) {
  return <>
    <section className="hero-row"><div><p className="eyebrow">WEDNESDAY · 08月26日</p><h1>今天穿什么，<br /><em>让体感告诉你。</em></h1><p className="subcopy">根据{city.name}全天气温与个人衣橱，给你一套从早到晚的安心选择。</p></div><div className="sun-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="sun-core"><Sun size={29} /></div></div></section>
    <section className="weather-panel"><div className="weather-head"><div className="location"><MapPin size={16} />{city.name} <span>· 自动定位</span></div><button className="text-btn" onClick={() => setShowCityPicker(true)}>切换城市 <ChevronRight size={14} /></button></div><div className="weather-main"><div><div className="temp-display">{temp}<span>°</span></div><div className="weather-desc"><CloudSun size={17} /> {city.weather} <strong>体感舒适</strong></div></div><div className="weather-note"><Wind size={17} /><span>东北风 2级<br /><b>湿度 42%</b></span></div></div><div className="day-slots"><WeatherSlot time="早晨 07:30" temp={city.slots[0]} icon={<CloudSun size={18} />} note={Number(city.slots[0].replace('°', '')) < 15 ? '微凉' : '舒适'} /><WeatherSlot time="白天 12:00" temp={city.slots[1]} icon={<Sun size={18} />} note={Number(city.slots[1].replace('°', '')) > 28 ? '偏热' : '舒适'} active /><WeatherSlot time="晚间 18:00" temp={city.slots[2]} icon={city.weather.includes('雨') ? <CloudRain size={18} /> : <CloudSun size={18} />} note={city.weather.includes('雨') ? '注意雨具' : '舒适'} /></div><div className="temperature-input"><div className="input-title"><Thermometer size={16} /> 你的体感温度</div><div className="temp-control"><input aria-label="体感温度" value={feltTemp} onChange={(e) => setFeltTemp(e.target.value)} /><span>用于校准今天的推荐</span><button className="small-action" onClick={() => setTemp(city.temp)}><RefreshCw size={14} /></button></div></div></section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">YOUR DAY, CURATED</p><h2>{explore ? '风格探索' : '今日适配度最高'}</h2></div><button className={`mode-toggle ${explore ? 'selected' : ''}`} onClick={() => setExplore(!explore)}><Sparkles size={15} />{explore ? '探索中' : '开启探索'}</button></div><p className="section-intro">{explore ? '在体感安全线内，试试衣橱里还没尝试过的组合。' : '早晚微凉，白天舒适。建议采用可增减的三层结构。'}</p><section className="insight-banner"><div className="insight-icon"><Heart size={19} /></div><div><strong>知温小提示</strong><p>办公室空调偏凉，外套建议随身可取。</p></div><ArrowRight size={17} /></section><div className="outfit-grid">{activeOutfits.slice(0, 4).map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} onClick={() => openOutfit(outfit)} onWear={() => wearOutfit(outfit)} />)}</div></section>
    {showGuide && <div className="guide-callout"><div className="guide-dot" /><div><strong>第一次来？</strong><p>登录后上传衣物，知温会根据你的体感持续学习。</p></div><button onClick={() => setShowGuide(false)}><X size={14} /></button><button className="guide-login" onClick={() => setShowLogin(true)}>登录体验</button></div>}
  </>
}

function WeatherSlot({ time, temp, icon, note, active = false }: { time: string; temp: string; icon: ReactNode; note: string; active?: boolean }) { return <div className={`weather-slot ${active ? 'active' : ''}`}><span>{time}</span><div>{icon}<b>{temp}</b></div><small>{note}</small></div> }
function CityPicker({ city, history, onBack, onSelect }: { city: City; history: City[]; onBack: () => void; onSelect: (city: City) => void }) {
  const [query, setQuery] = useState('')
  const visibleCities = allDomesticCities.filter((option) => option.name.includes(query.trim()) || option.initial.toLowerCase().includes(query.trim().toLowerCase()))
  const popularCities = cityOptions.filter((option) => ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '武汉', '西安', '南京', '厦门', '昆明'].includes(option.name))
  const initials = Array.from(new Set(allDomesticCities.map((option) => option.initial))).sort()
  return <section className="city-page"><div className="detail-back"><button className="back-btn" aria-label="返回首页" onClick={onBack}>←</button><span>选择所在地区</span></div><div className="city-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索城市" autoFocus /><button aria-label="清除搜索" className={query ? 'visible' : ''} onClick={() => setQuery('')}><X size={15} /></button></div>{query ? <section className="city-results"><h2>搜索结果</h2>{visibleCities.length ? visibleCities.map((option) => <button className="city-result-row" key={option.name} onClick={() => onSelect(option)}><span>{option.name}</span><small>{option.weather} · {option.summary}</small><ChevronRight size={17} /></button>) : <p className="city-empty">未找到该国内城市，请更换关键词。</p>}</section> : <><section className="city-block"><h2>当前位置</h2><button className="location-row" onClick={() => onSelect(city)}><MapPin size={19} /><span><strong>{city.name}</strong><small>已定位，可用于今日推荐</small></span><Check size={17} /></button></section><section className="city-block"><h2>历史选择</h2><div className="city-chip-grid">{history.map((option) => <button key={option.name} className={option.name === city.name ? 'selected' : ''} onClick={() => onSelect(option)}>{option.name}</button>)}</div></section><section className="city-block"><h2>热门城市</h2><div className="city-chip-grid popular-grid">{popularCities.map((option) => <button key={option.name} className={option.name === city.name ? 'selected' : ''} onClick={() => onSelect(option)}>{option.name}</button>)}</div></section><section className="city-block city-directory"><h2>全部国内城市</h2>{initials.map((initial) => <div className="city-letter-group" id={`city-${initial}`} key={initial}><strong>{initial}</strong><div>{allDomesticCities.filter((option) => option.initial === initial).map((option) => <button key={option.name} className={option.name === city.name ? 'selected' : ''} onClick={() => onSelect(option)}>{option.name}</button>)}</div></div>)}</section><nav className="letter-index" aria-label="城市字母索引">{initials.map((initial) => <a href={`#city-${initial}`} key={initial}>{initial}</a>)}</nav></>}</section>
}
function OutfitCard({ outfit, onClick, onWear }: { outfit: Outfit; onClick: () => void; onWear?: () => void }) { return <article className="outfit-card" role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick() }}><div className="outfit-art"><div className="art-backdrop" />{outfit.colors.map((color, index) => <div key={color + index} className={`art-piece piece-${index}`} style={{ background: color }} />)}<span className={`fit-badge ${outfit.level === '高适配' ? 'good' : 'ok'}`}>{outfit.level}</span><span className="art-count">{outfit.items.length} 件组合</span></div><div className="outfit-info"><div><h3>{outfit.title}</h3><p>{outfit.note}</p></div><ChevronRight size={17} /></div><div className="outfit-meta">{outfit.styles.map((style) => <span key={style}>{style}</span>)}</div>{onWear && <div className="outfit-action"><button onClick={(event) => { event.stopPropagation(); onWear() }}>今天穿这套</button></div>}</article> }

function ExplorePage({ outfits, preferredStyles, openOutfit }: { outfits: Outfit[]; preferredStyles: string[]; openOutfit: (outfit: Outfit) => void }) {
  const styleScore = (outfit: Outfit) => outfit.styles.filter((style) => preferredStyles.includes(style)).length
  const orderedOutfits = [...outfits].sort((a, b) => (b.level === '高适配' ? 2 : b.level === '基本适配' ? 1 : 0) - (a.level === '高适配' ? 2 : a.level === '基本适配' ? 1 : 0) || styleScore(b) - styleScore(a) || a.id - b.id).slice(0, 10)
  return <><section className="page-title-row explore-title"><div><p className="eyebrow">WARDROBE MIX · {orderedOutfits.length} OPTIONS</p><h1>搭配探索</h1><p className="subcopy">展示衣橱中符合今日温度且当前可穿的全部组合，最多查看 10 套。</p></div><div className="explore-count"><strong>{orderedOutfits.length}</strong><span>套可查看</span></div></section><div className="explore-rule"><Check size={16} /><span>先按体感安全线筛选，再按个人偏好风格排序：{preferredStyles.join(' · ')}。</span></div><div className="outfit-grid explore-grid">{orderedOutfits.map((outfit) => <OutfitCard key={outfit.id} outfit={outfit} onClick={() => openOutfit(outfit)} />)}</div></>
}

function WardrobePage({ category, setCategory, filteredItems, search, setSearch, filters, setFilters, tags, showFilters, setShowFilters, onAddClothing, onToggleStatus, setNotice }: { category: Category; setCategory: (v: Category) => void; filteredItems: Item[]; search: string; setSearch: (v: string) => void; filters: WardrobeFilters; setFilters: (v: WardrobeFilters) => void; tags: string[]; showFilters: boolean; setShowFilters: (v: boolean) => void; onAddClothing: () => void; onToggleStatus: (id: number) => void; setNotice: (v: string) => void }) { const activeFilterCount = (filters.status !== '全部' ? 1 : 0) + (filters.recognition !== '全部' ? 1 : 0) + filters.tag.length; return <><section className="page-title-row"><div><p className="eyebrow">MY CLOSET · {filteredItems.length} SHOWN</p><h1>衣橱扫描</h1><p className="subcopy">已确认的衣物，才会进入今日搭配。</p></div><button className="primary-btn" onClick={onAddClothing}><Plus size={17} />添加衣物</button></section><div className="search-row"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索衣物或标签" aria-label="搜索衣物或标签" /></label><button className={`filter-btn ${activeFilterCount ? 'active' : ''}`} onClick={() => setShowFilters(true)}><span />筛选{activeFilterCount ? ` ${activeFilterCount}` : ''}</button></div><div className="category-row">{categories.map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>{filteredItems.length ? <div className="wardrobe-grid">{filteredItems.map((item) => <ClothingCard key={item.id} item={item} onStatus={() => { onToggleStatus(item.id); setNotice(item.status === '可穿' ? `${item.name} 已标记为暂时不能穿` : `${item.name} 已恢复可穿`) }} />)}<button className="upload-card" onClick={onAddClothing}><div className="upload-icon"><Plus size={22} /></div><strong>添加一件衣物</strong><span>拍照或从相册选择</span></button></div> : <div className="wardrobe-empty"><Search size={24} /><strong>没有符合条件的衣物</strong><span>可以清除筛选，或调整搜索关键词。</span><button onClick={() => { setSearch(''); setFilters({ status: '全部', recognition: '全部', tag: [] }) }}>清除条件</button></div>}<div className="confirm-note"><Check size={16} /><span><strong>AI 识别后由你确认</strong><br />衣物类别、结构和风格标签均可编辑，确认后才会参与推荐。</span></div>{showFilters && <FilterSheet filters={filters} tags={tags} onClose={() => setShowFilters(false)} onApply={(nextFilters) => { setFilters(nextFilters); setShowFilters(false) }} />}</> }
function FilterSheet({ filters, tags, onClose, onApply }: { filters: WardrobeFilters; tags: string[]; onClose: () => void; onApply: (filters: WardrobeFilters) => void }) {
  const [draft, setDraft] = useState<WardrobeFilters>(filters)
  const update = <K extends keyof WardrobeFilters>(key: K, value: WardrobeFilters[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const toggleTag = (tag: string) => setDraft((current) => ({ ...current, tag: current.tag.includes(tag) ? current.tag.filter((item) => item !== tag) : [...current.tag, tag] }))
  const scalarOptions = <K extends 'status' | 'recognition'>(key: K, title: string, values: WardrobeFilters[K][]) => <section className="filter-group"><h3>{title}</h3><div className="filter-options">{values.map((value) => <button key={value} className={draft[key] === value ? 'selected' : ''} onClick={() => update(key, value)}>{value}</button>)}</div></section>
  return <div className="modal-layer" onClick={onClose}><section className="filter-sheet" onClick={(event) => event.stopPropagation()}><header className="filter-sheet-head"><div><p className="eyebrow">FILTER WARDROBE</p><h2>筛选衣物</h2></div><button className="modal-close inline-close" aria-label="关闭筛选" onClick={onClose}><X size={18} /></button></header>{scalarOptions('status', '可穿状态', ['全部', '可穿', '暂时不能穿'])}{scalarOptions('recognition', '识别状态', ['全部', '已确认', '待确认'])}<section className="filter-group"><h3>风格、面料与功能标签</h3><div className="filter-options"><button className={!draft.tag.length ? 'selected' : ''} onClick={() => update('tag', [])}>全部</button>{tags.map((tag) => <button key={tag} className={draft.tag.includes(tag) ? 'selected' : ''} onClick={() => toggleTag(tag)}>{tag}</button>)}</div><p className="filter-hint">可多选标签，命中任一标签的衣物都会展示</p></section><footer className="filter-sheet-actions"><button className="filter-reset" onClick={() => setDraft({ status: '全部', recognition: '全部', tag: [] })}>重置</button><button className="filter-apply" onClick={() => onApply(draft)}>应用筛选</button></footer></section></div>
}
function ClothingCard({ item, onStatus }: { item: Item; onStatus: () => void }) { return <div className={`clothing-card ${item.status !== '可穿' ? 'unavailable' : ''}`}><div className="clothing-card-top"><ClothingVisual item={item} /><button className="more-btn"><span /><span /><span /></button></div><div className="clothing-card-info"><div><h3>{item.name}</h3><p>{item.category} · {item.color}</p></div><button className={`status-chip ${item.status !== '可穿' ? 'paused' : ''}`} onClick={onStatus}>{item.status === '可穿' ? <Check size={12} /> : <span className="pause-icon"><i /><i /></span>} {item.status}</button></div><div className="tag-list">{item.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></div> }

function ReplaceItemPage({ outfit, items, replaceItemId, candidates, onBack, onSelect }: { outfit: Outfit; items: Item[]; replaceItemId: number | null; candidates: { item: Item; score: number }[]; onBack: () => void; onSelect: (itemId: number) => void }) {
  const current = items.find((item) => item.id === replaceItemId)
  const remainingCount = outfit.items.filter((id) => id !== replaceItemId).length
  return <section className="replace-page"><div className="detail-back"><button className="back-btn" aria-label="返回搭配详情" onClick={onBack}>←</button><span>替换单品</span></div><section className="replace-intro"><p className="eyebrow">REPLACE ONE ITEM</p><h1>为「{current?.name || '这件衣物'}」换一件</h1><p>仅替换这一件，其他 {remainingCount} 件衣物保持不变。候选按与当前搭配的匹配度排序。</p></section>{candidates.length ? <div className="replacement-list">{candidates.map(({ item, score }, index) => <button className="replacement-card" key={item.id} onClick={() => onSelect(item.id)}><ClothingVisual item={item} small /><span className="replacement-copy"><strong>{item.name}</strong><small>{item.category} · {item.color}</small><em>{item.tags.slice(0, 3).join(' · ')}</em></span><span className="replacement-score"><b>{score}%</b><small>{index === 0 ? '最匹配' : '搭配度'}</small></span><ChevronRight size={17} /></button>)}</div> : <div className="replace-empty"><Shirt size={25} /><strong>暂无可替换的同品类衣物</strong><span>请先在衣橱中添加并确认一件可穿的{current?.category || '同品类'}。</span></div>}</section>
}

function DetailPage({ outfit, items, temp, worn, setWorn, feedback, saveFeedback, replaceOutfit, openOutfit, outfits, onReplaceItem, onBack }: { outfit: Outfit; items: Item[]; temp: string; worn: boolean; setWorn: (v: boolean) => void; feedback: Feedback; saveFeedback: (v: Feedback) => void; replaceOutfit: () => void; openOutfit: (outfit: Outfit) => void; outfits: Outfit[]; onReplaceItem: (itemId: number) => void; onBack: () => void }) {
  const outfitItems = outfit.items.map((id) => items.find((item) => item.id === id)).filter(Boolean) as Item[]
  return <><div className="detail-back"><button className="back-btn" aria-label="返回上一级" onClick={onBack}>←</button><span>搭配详情</span><button className="share-btn"><Heart size={18} /></button></div><section className="detail-hero"><div className="detail-art"><div className="detail-wardrobe-art">{outfitItems.map((item) => <div className="detail-garment" key={item.id}><ClothingVisual item={item} /><span>{item.name}</span></div>)}</div></div><div className="detail-summary"><span className="fit-badge good">{outfit.level}</span><p className="eyebrow">TODAY'S OUTFIT · 01</p><h1>{outfit.title}</h1><p>{outfit.note}</p><div className="detail-style-row">{outfit.styles.map((style) => <span key={style}>{style}</span>)}<span>北京 · {temp}°</span></div></div></section><section className="time-card"><div className="time-card-head"><div><p className="eyebrow">全日体感预测</p><h2>一套衣服，三个时刻</h2></div><span className="updated">刚刚更新</span></div><div className="timeline">{outfit.slots.map((slot, index) => <div className="timeline-item" key={slot.label}><div className="timeline-dot">{index === 0 ? <CloudSun size={16} /> : index === 1 ? <Sun size={16} /> : <CloudRain size={16} />}</div><div><strong>{slot.label}</strong><p>{slot.value}</p></div></div>)}</div></section><section className="detail-section"><div className="section-heading"><div><p className="eyebrow">真实衣橱组合</p><h2>这套搭配包含</h2></div><button className="text-btn">全部 {outfitItems.length} 件 <ChevronRight size={14} /></button></div><div className="detail-item-list">{outfitItems.map((item) => <div className="detail-item" key={item.id}><ClothingVisual item={item} small /><div><strong>{item.name}</strong><p>{item.tags[0]} · {item.color}</p></div><button className="replace-btn" onClick={() => onReplaceItem(item.id)}>换一件</button></div>)}</div></section><section className="feedback-card"><div><p className="eyebrow">出门前告诉知温</p><h2>这套今天穿吗？</h2><p>只有确认穿着，明天的回访才会更准确。</p></div><button className={`wear-btn ${worn ? 'done' : ''}`} onClick={() => setWorn(!worn)}>{worn ? <><Check size={18} /> 已选穿</> : <>今天穿这套 <ArrowRight size={17} /></>}</button></section>{worn && <section className="feedback-section"><p className="eyebrow">轻量反馈</p><h2>现在的体感更接近哪一种？</h2><div className="feedback-row">{(['偏冷', '刚好', '偏热'] as Feedback[]).map((value) => <button key={value} className={feedback === value ? 'chosen' : ''} onClick={() => saveFeedback(value)}>{value}</button>)}</div></section>}<section className="more-outfits"><div className="section-heading"><div><p className="eyebrow">MORE OPTIONS</p><h2>换一套看看</h2></div><button className="icon-btn light" onClick={replaceOutfit}><RefreshCw size={17} /></button></div><div className="mini-outfits">{outfits.filter((item) => item.id !== outfit.id).slice(0, 3).map((item) => <button key={item.id} onClick={() => openOutfit(item)}><div className="mini-art">{item.colors.slice(0, 3).map((color, index) => <span key={color + index} style={{ background: color }} />)}</div><strong>{item.title}</strong><small>{item.level}</small></button>)}</div></section></>
}

function ProfilePage({ explore, setExplore, preferredStyles, isLoggedIn, onOpenEditor, setShowLogin, setNotice }: { explore: boolean; setExplore: (v: boolean) => void; preferredStyles: string[]; isLoggedIn: boolean; onOpenEditor: () => void; setShowLogin: (v: boolean) => void; setNotice: (v: string) => void }) { const handleEdit = () => { if (isLoggedIn) onOpenEditor(); else setShowLogin(true) }; return <><section className="profile-head"><div className="profile-avatar">林</div><div><p className="eyebrow">MY PROFILE</p><h1>林同学</h1><p>北京 · 日常通勤</p></div><button className="edit-btn" onClick={handleEdit}>编辑</button></section><section className="profile-insight"><div className="profile-insight-icon"><Thermometer size={20} /></div><div><strong>你的体感档案</strong><p>对早晚温差较敏感，办公室空调环境偏冷。</p></div><ChevronRight size={17} /></section><div className="profile-grid"><ProfileStat value="08" label="衣橱单品" /><ProfileStat value="12" label="已穿搭配" /><ProfileStat value="78%" label="体感刚好" /></div><section className="settings-section"><div className="section-heading"><div><p className="eyebrow">PREFERENCES</p><h2>偏好设置</h2></div></div><SettingRow icon={<Sparkles size={17} />} title="风格偏好" value={preferredStyles.join(' · ')} onClick={handleEdit} /><SettingRow icon={<Heart size={17} />} title="灵感风格库" value="后续开放" onClick={() => setNotice('灵感风格库将在后续版本开放')} /><SettingRow icon={<Compass size={17} />} title="探索模式" value={explore ? '已开启' : '未开启'} toggle onClick={() => setExplore(!explore)} enabled={explore} /><SettingRow icon={<Bell size={17} />} title="天气变化提醒" value="已开启" onClick={() => setNotice('提醒设置已打开')} /><SettingRow icon={<Trash2 size={17} />} title="隐私与数据管理" value="" onClick={() => setNotice('数据管理入口已准备，Demo 中仅展示交互')} /></section><section className="history-section"><div className="section-heading"><div><p className="eyebrow">RECENT FEEDBACK</p><h2>最近的体感记录</h2></div><button className="text-btn">查看全部 <ChevronRight size={14} /></button></div><div className="history-list"><HistoryRow date="昨天 · 08月25日" outfit="灰调轻盈" feeling="刚好" color="green" /><HistoryRow date="08月22日" outfit="深色层次" feeling="偏冷" color="blue" /></div></section><div className="profile-footnote">知温提供日常穿衣与天气辅助建议，不提供医疗诊断或治疗建议。</div></> }
function ProfileStat({ value, label }: { value: string; label: string }) { return <div className="profile-stat"><strong>{value}</strong><span>{label}</span></div> }
function SettingRow({ icon, title, value, onClick, toggle, enabled }: { icon: ReactNode; title: string; value: string; onClick?: () => void; toggle?: boolean; enabled?: boolean }) { return <button className="setting-row" onClick={onClick}><span className="setting-icon">{icon}</span><span className="setting-copy"><strong>{title}</strong><small>{value}</small></span>{toggle ? <span className={`toggle ${enabled ? 'on' : ''}`}><i /></span> : <ChevronRight size={17} />}</button> }
const styleGroups: { title: string; options: string[] }[] = [
  { title: '日常场景', options: ['通勤', '休闲', '运动', '约会'] },
  { title: '风格气质', options: ['简约', '复古', '学院', '街头'] },
  { title: '地域灵感', options: ['日系', '韩系', '欧美', '国风'] },
]

function ProfileEditSheet({ title = '编辑风格偏好', styles, onClose, onSave }: { title?: string; styles: string[]; onClose: () => void; onSave: (styles: string[]) => void }) {
  const [draft, setDraft] = useState(() => styleGroups.map((group) => group.options.find((option) => styles.includes(option)) || group.options[0]))
  const select = (groupIndex: number, style: string) => setDraft((current) => current.map((value, index) => index === groupIndex ? style : value))
  const reset = () => setDraft(styleGroups.map((group) => group.options[0]))
  return <div className="modal-layer" onClick={onClose}><section className="profile-edit-sheet" onClick={(event) => event.stopPropagation()}><header className="filter-sheet-head"><div><p className="eyebrow">EDIT PREFERENCES</p><h2>{title}</h2></div><button className="modal-close inline-close" aria-label="关闭编辑" onClick={onClose}><X size={18} /></button></header><p className="profile-edit-copy">统一设置日常推荐和风格探索偏好。每组选择一个，组合后会用于搭配排序。</p>{styleGroups.map((group, groupIndex) => <section className="style-group" key={group.title}><div className="style-group-heading"><h3>{group.title}</h3><span>单选</span></div><div className="style-choice-grid">{group.options.map((style) => <button key={style} className={draft[groupIndex] === style ? 'selected' : ''} aria-pressed={draft[groupIndex] === style} onClick={() => select(groupIndex, style)}>{style}</button>)}</div></section>)}<footer className="filter-sheet-actions"><button className="filter-reset" onClick={reset}>恢复默认</button><button className="filter-apply" onClick={() => onSave(draft)}>保存偏好</button></footer></section></div>
}
function HistoryRow({ date, outfit, feeling, color }: { date: string; outfit: string; feeling: string; color: string }) { return <div className="history-row"><div className="history-date">{date}</div><strong>{outfit}</strong><span className={`feeling ${color}`}>{feeling}</span><ChevronRight size={15} /></div> }
function LoginSheet({ onClose, onLogin }: { onClose: () => void; onLogin: () => void }) {
  const [authorizing, setAuthorizing] = useState(false)
  const authorizationTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (authorizationTimer.current !== null) window.clearTimeout(authorizationTimer.current)
  }, [])
  const authorize = () => {
    if (authorizing) return
    setAuthorizing(true)
    authorizationTimer.current = window.setTimeout(() => {
      authorizationTimer.current = null
      onLogin()
    }, 550)
  }
  return <div className="modal-layer" onClick={onClose}><div className="login-sheet" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={18} /></button><div className="login-symbol"><Thermometer size={25} /></div><p className="eyebrow">WELCOME TO ZHIWEN</p><h2>让衣橱，更懂你的体感</h2><p>登录后上传衣物，知温会根据天气和你的反馈持续校准推荐。</p><button className="wechat-btn" disabled={authorizing} onClick={authorize}>{authorizing ? '正在请求微信授权…' : '微信授权登录'} {!authorizing && <ArrowRight size={17} />}</button><small>{authorizing ? '请在微信授权弹窗中确认' : '仅用于保存衣橱与偏好，不读取购物平台订单。'}</small></div></div>
}

function UploadSheet({ onClose, onFileSelected }: { onClose: () => void; onFileSelected: (source: string, file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState('拍照识别')
  const chooseFile = (nextSource: string) => { setSource(nextSource); inputRef.current?.click() }
  return <div className="modal-layer" onClick={onClose}><div className="login-sheet upload-sheet" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">ADD TO WARDROBE</p><h2>添加一件衣物</h2><p>选择输入方式，识别完成后请确认类别、面料和保暖标签。</p><input ref={inputRef} className="file-input" type="file" accept="image/*" capture={source === '拍照识别' ? 'environment' : undefined} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFileSelected(source, file); event.target.value = '' }} /><div className="upload-options"><button className="upload-option" onClick={() => chooseFile('拍照识别')}><div><Sun size={18} /><strong>拍照识别</strong><small>拍摄单件衣物</small></div><ChevronRight size={17} /></button><button className="upload-option" onClick={() => chooseFile('相册识别')}><div><Shirt size={18} /><strong>从相册选择</strong><small>上传已有衣物照片</small></div><ChevronRight size={17} /></button><button className="upload-option" onClick={() => chooseFile('商品详情截图')}><div><Search size={18} /><strong>商品详情截图</strong><small>辅助补充面料信息</small></div><ChevronRight size={17} /></button></div></div></div>
}

function UploadConfirmSheet({ draft, onClose, onConfirm }: { draft: UploadDraft; onClose: () => void; onConfirm: (item: Item) => void }) {
  const [recognizing, setRecognizing] = useState(true)
  const [name, setName] = useState(draft.source === '商品详情截图' ? '米白针织开衫' : '新上传衣物')
  const [category, setCategory] = useState<Exclude<Category, '全部'>>('上衣')
  const [color, setColor] = useState('米白')
  const [fabric, setFabric] = useState(draft.source === '商品详情截图' ? '棉混纺' : '待确认')
  const [tags, setTags] = useState('通勤, 简约, 保暖层')
  const [available, setAvailable] = useState(true)
  useEffect(() => { const timer = window.setTimeout(() => setRecognizing(false), 900); return () => window.clearTimeout(timer) }, [])
  const save = () => { const categoryVisual: Record<string, Item['visual']> = { 上衣: 'shirt', 裤子: 'pants', 连衣裙: 'dress', 半身裙: 'skirt', 外套: 'coat', 鞋子: 'shoe', 配饰: 'scarf', 包袋: 'bag' }; onConfirm({ id: Date.now(), name: name.trim() || '未命名衣物', category, color: color.trim() || '未标注', tint: '#d9d6ce', tags: [fabric.trim() || '待确认', ...tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)].slice(0, 4), status: available ? '可穿' : '暂时不能穿', recognition: '已确认', visual: categoryVisual[category] || 'shirt', imageUrl: draft.preview }) }
  return <div className="modal-layer" onClick={onClose}><div className="confirm-sheet" onClick={(event) => event.stopPropagation()}><div className="confirm-sheet-head"><div><p className="eyebrow">AI RECOGNITION</p><h2>确认衣物信息</h2></div><button className="modal-close inline-close" onClick={onClose}><X size={18} /></button></div><div className="recognition-layout"><div className="upload-preview"><img src={draft.preview} alt="上传的衣物" /><button className="delete-image" onClick={onClose}><Trash2 size={14} />删除原图</button></div><div className={`recognition-status ${recognizing ? 'loading' : 'done'}`}>{recognizing ? <><RefreshCw size={15} />正在识别衣物信息…</> : <><Check size={15} />已完成识别，请确认后加入衣橱</>}</div></div>{!recognizing && <><div className="confidence-note"><Sparkles size={15} /><span>以下为模拟识别结果。你可编辑类别、面料和标签，确认后才参与搭配。</span></div><div className="confirm-form"><label>衣物名称<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>衣物类别<select value={category} onChange={(event) => setCategory(event.target.value as Exclude<Category, '全部'>)}>{(['上衣', '裤子', '连衣裙', '半身裙', '外套', '鞋子', '配饰', '包袋'] as Exclude<Category, '全部'>[]).map((option) => <option key={option}>{option}</option>)}</select></label><label>颜色<input value={color} onChange={(event) => setColor(event.target.value)} /></label><label>面料<input value={fabric} onChange={(event) => setFabric(event.target.value)} /></label><label className="wide-field">标签（逗号分隔）<input value={tags} onChange={(event) => setTags(event.target.value)} /></label><button className={`availability-toggle ${available ? 'available' : ''}`} onClick={() => setAvailable(!available)}>{available ? <Check size={15} /> : <X size={15} />}{available ? '当前可穿，可参与搭配' : '暂时不能穿，不参与搭配'}</button></div><button className="confirm-add-btn" onClick={save}>确认加入衣橱 <Check size={17} /></button></>}</div></div>
}
