// 图片源定义（零平台依赖的纯数据 + 纯函数）
// 和谐版：只保留两个「全年龄、公开接口」的源。
// 已移除：
//  · 雪涼 Setu —— 需要 API Key，且提供分级筛选
//  · Lolicon    —— 提供分级筛选（含 R18）
// 保留：
//  · Pixiv Yuki   —— 随机 Pixiv 插画，全年龄
//  · Anime Gateway —— ACG 壁纸直连，全年龄

export const SOURCE_IDS = ['yuki', 'icatw']

// 字段类型：select 有 options 数组；input 有 placeholder 与 hint
export const SOURCES = {
  yuki: {
    id: 'yuki',
    name: 'Pixiv Yuki',
    desc: '随机 Pixiv 插画（含作品信息）',
    endpoint: 'https://pixiv.yuki.sh/api/recommend',
    fields: [
      {
        key: 'type',
        label: '返回类型',
        type: 'select',
        options: [
          { label: 'JSON 数据', value: 'json' },
          { label: '图片直出', value: 'img' },
        ],
        default: 'json',
      },
      {
        key: 'size',
        label: '图片尺寸',
        type: 'select',
        options: [
          { label: '常规 regular', value: 'regular' },
          { label: '小图 small', value: 'small' },
          { label: '原图 original', value: 'original' },
        ],
        default: 'regular',
      },
      {
        key: 'proxy',
        label: '代理域名',
        type: 'input',
        placeholder: '如 i.pixiv.re',
        hint: '图片代理域名',
        default: 'i.pixiv.re',
      },
    ],
  },

  // icatw：直连上游图站（每次请求都是新图）。
  // 不用它的网关 API：注册表里 4 个源全是 anime、没有竖屏源，
  // 且服务端对「category+orientation」做 5 分钟缓存，连点只会拿到同一张。
  icatw: {
    id: 'icatw',
    name: 'Anime Gateway',
    desc: 'ACG 壁纸直连（每次都是新图）',
    endpoint: 'https://t.alcy.cc/pc',
    // 直连源：选中的上游 URL 本身就是图片（服务端 302 到随机图），不必先请求一次 JSON
    direct: true,
    fields: [
      {
        key: 'source',
        label: '图片来源',
        type: 'select',
        options: [
          { label: '自动轮换', value: '' },
          { label: 'alcy 壁纸', value: 'alcy-pc' },
          { label: 'alcy 二次元', value: 'alcy-moe' },
          { label: 'xjh ACG', value: 'xjh-acg' },
          { label: 'paugram', value: 'paugram' },
          { label: 'loliapi 竖屏', value: 'loliapi' },
        ],
        default: '',
        hint: '竖屏请选 loliapi；其余为横屏',
      },
    ],
  },
}

// 取某个源
export function getSource(id) {
  return SOURCES[id] || null
}

// 该源的所有字段
export function sourceFields(id) {
  const s = getSource(id)
  return s ? s.fields : []
}

// 该源的默认配置（用于首次进入 / 重置）
export function defaultConfig(id) {
  const s = getSource(id)
  const cfg = {}
  if (s) {
    for (const f of s.fields) {
      cfg[f.key] = f.default
    }
  }
  return cfg
}

// 判断某字段是否需要用输入法输入
export function isInputField(id, key) {
  const s = getSource(id)
  if (!s) return false
  const f = s.fields.find((x) => x.key === key)
  return !!f && f.type === 'input'
}

// 判断某字段是否有预选项
export function fieldOptions(id, key) {
  const s = getSource(id)
  if (!s) return []
  const f = s.fields.find((x) => x.key === key)
  return f && f.options ? f.options : []
}
