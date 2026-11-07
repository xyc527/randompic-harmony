// Node 侧纯函数单测（零平台依赖）—— 和谐版
// 与完整版的差别：只剩 yuki / icatw 两个源，凡涉及 setu / lolicon 的断言全部去掉。
import {
  SOURCE_IDS, getSource, sourceFields, defaultConfig, isInputField, fieldOptions,
} from '../src/lib/sources.js'
import {
  buildUrl, extractImageUrl, buildFilename, guessExt, sanitizeConfig, sourceName,
  makeImageName, proxyResizeUrl, pixivSmallUrl,
  ICATW_UPSTREAM, ICATW_KEYS, ICATW_GATEWAY,
} from '../src/lib/config.js'
import {
  b64enc, normPath, parentOf, shellQuote, shellWriteCmds,
  mergeCfgText, pickCfg, saveVerdict,
} from '../src/lib/persist.js'

let pass = 0, fail = 0
function check(name, ok, got) {
  if (ok) { pass++; console.log('  ok   ' + name) }
  else { fail++; console.log('  FAIL ' + name + '  got=' + JSON.stringify(got)) }
}

// ===== 源定义：和谐版只保留两个 =====
check('只有两个源', SOURCE_IDS.length === 2)
check('源顺序 yuki -> icatw', SOURCE_IDS.join(',') === 'yuki,icatw')
check('setu 已移除', getSource('setu') === null)
check('lolicon 已移除', getSource('lolicon') === null)
check('yuki 字段数=3', sourceFields('yuki').length === 3)
check('icatw 字段数=1（只剩图片来源）', sourceFields('icatw').length === 1)
check('getSource 空 id 返回 null', getSource('nope') === null)
check('两个源都没有分级字段', !sourceFields('yuki').some((f) => f.key === 'r18') &&
  !sourceFields('icatw').some((f) => f.key === 'r18'))
check('两个源都没有 notice 文案', !getSource('yuki').notice && !getSource('icatw').notice)

// ===== 默认配置 =====
check('yuki 默认 proxy', defaultConfig('yuki').proxy === 'i.pixiv.re')
check('yuki 默认 type', defaultConfig('yuki').type === 'json')
check('yuki 默认 regular', defaultConfig('yuki').size === 'regular')
check('icatw 默认自动轮换', defaultConfig('icatw').source === '')
check('setu 默认配置为空', Object.keys(defaultConfig('setu')).length === 0)

// ===== 字段类型判断 =====
check('yuki proxy 是 input', isInputField('yuki', 'proxy') === true)
check('yuki type 不是 input', isInputField('yuki', 'type') === false)
check('icatw source 不是 input', isInputField('icatw', 'source') === false)
check('yuki size 有 3 个选项', fieldOptions('yuki', 'size').length === 3)
check('icatw source 有 6 个选项', fieldOptions('icatw', 'source').length === 6)
check('未知源没有选项', fieldOptions('setu', 'r18').length === 0)

// ===== URL 构建 =====
let u = buildUrl('yuki', { type: 'json', size: 'original', proxy: 'i.pixiv.re' })
check('yuki json url 含 type/size/proxy',
  u.includes('type=json') && u.includes('size=original') && u.includes('proxy=i.pixiv.re'), u)

u = buildUrl('yuki', { type: 'img', size: 'original', proxy: 'i.pixiv.re' })
check('yuki 直出不带 type 参数', !u.includes('type='), u)

u = buildUrl('yuki', { type: 'json', size: 'regular', proxy: 'i.pixiv.re' })
check('yuki 带 _t 破坏缓存', u.includes('_t='), u)
check('yuki 空 proxy 跳过该参数', !buildUrl('yuki', { type: 'json', size: 'regular', proxy: '' }).includes('proxy='))

check('已移除的源构建不出 URL', buildUrl('setu', {}) === '' && buildUrl('lolicon', {}) === '')
check('未知源返回空串', buildUrl('nope', {}) === '')

// icatw 直连上游：URL 就是图片本身
u = buildUrl('icatw', { source: 'alcy-moe' })
check('icatw alcy-moe 直连', u.indexOf('https://t.alcy.cc/moe') === 0, u)
check('icatw alcy-moe 带破缓存参数', u.includes('_t='), u)

u = buildUrl('icatw', { source: 'xjh-acg' })
check('icatw xjh 直连', u.indexOf('https://img.xjh.me/random_img.php') === 0, u)
check('icatw xjh 用 & 接参数', u.includes('&_t='), u)

check('icatw loliapi 走竖屏入口',
  buildUrl('icatw', { source: 'loliapi' }).indexOf('https://www.loliapi.com/acg/pe/') === 0)
check('icatw paugram 直连',
  buildUrl('icatw', { source: 'paugram' }).indexOf('https://api.paugram.com/wallpaper/') === 0)

// 空值/未知值 = 自动轮换：必须落在 4 个横屏站里，且多次调用会换站
{
  const hosts = new Set()
  for (let i = 0; i < 40; i += 1) {
    const uu = buildUrl('icatw', { source: '' })
    const m = /^https?:\/\/([^/]+)\//.exec(uu)
    hosts.add(m ? m[1] : 'bad')
  }
  check('icatw 自动轮换会换站', hosts.size >= 2 && [...hosts].every((h) => h !== 'bad'), [...hosts].join(','))
  check('icatw 自动轮换不含 loliapi', !hosts.has('www.loliapi.com'), [...hosts].join(','))
  check('icatw 自动池=4 个横屏站', ICATW_KEYS.length === 4 && !ICATW_KEYS.includes('loliapi'), ICATW_KEYS.join(','))
  const unknown = buildUrl('icatw', { source: '__nope__' })
  check('icatw 未知取值回落自动',
    ICATW_KEYS.some((k) => unknown.indexOf(ICATW_UPSTREAM[k].slice(0, 24)) === 0), unknown)
}

// 和谐版把「网关 API」选项去掉了：它没有竖屏源且 5 分钟才换一张
check('和谐版没有 gateway 选项',
  !sourceFields('icatw').find((f) => f.key === 'source').options.some((o) => o.value === 'gateway'))
check('直接传 gateway 仍能构建（防御式，不在 UI 里暴露）',
  buildUrl('icatw', { source: 'gateway' }).indexOf(ICATW_GATEWAY.slice(0, 40)) === 0)
check('icatw 标了 direct', getSource('icatw').direct === true)

// ===== 图片 URL 提取 =====
check('yuki urls.original',
  extractImageUrl('yuki', { success: true, data: { id: '1', title: 'T', urls: { original: 'https://x/o.jpg' }, user: { name: 'A' } } }).url === 'https://x/o.jpg')
check('yuki 尊重 sizeHint 取 regular',
  extractImageUrl('yuki', { data: { urls: { original: 'https://x/o.jpg', regular: 'https://x/r.jpg' } } }, 'regular').url === 'https://x/r.jpg')
check('yuki sizeHint 缺失回退 original',
  extractImageUrl('yuki', { data: { urls: { original: 'https://x/o.jpg' } } }, 'regular').url === 'https://x/o.jpg')
check('yuki meta 作者',
  extractImageUrl('yuki', { data: { urls: { regular: 'https://x/r.jpg' }, user: { name: '作者名' } } }).meta.author === '作者名')
check('yuki 无 url 返回 null', extractImageUrl('yuki', {}) === null)
check('yuki 无 urls 返回 null', extractImageUrl('yuki', { data: { title: 'T' } }) === null)

check('icatw data.url',
  extractImageUrl('icatw', { success: true, data: { url: 'https://x/i.jpg', source: 'xjh-acg' } }).url === 'https://x/i.jpg')
check('icatw 无 data 返回 null', extractImageUrl('icatw', {}) === null)
{
  const r = extractImageUrl('icatw', { data: { url: 'https://img.xjh.me/a.jpg', proxyUrl: 'https://api.icatw.site/p/1', id: '1' } })
  check('icatw 优先用 proxyUrl 下载', r.url === 'https://api.icatw.site/p/1', r.url)
  check('icatw 保留原站地址', r.origin === 'https://img.xjh.me/a.jpg', r.origin)
  const r2 = extractImageUrl('icatw', { data: { url: 'https://img.xjh.me/a.jpg' } })
  check('icatw 无 proxyUrl 回退原站', r2.url === 'https://img.xjh.me/a.jpg', r2.url)
}

check('已移除的源提取返回 null', extractImageUrl('setu', { data: [{ urls: { original: 'https://x/o.png' } }] }) === null)
check('已移除的源提取返回 null(2)', extractImageUrl('lolicon', { data: [{ urls: { regular: 'https://x/r.jpg' } }] }) === null)

// ===== 文件名 / 扩展名 =====
check('buildFilename 含源名', buildFilename('yuki', 'jpg').indexOf('yuki_') === 0)
check('buildFilename 保留扩展名', /\.jpg$/.test(buildFilename('icatw', 'png')) === false)
check('guessExt jpg', guessExt('https://x/a.jpg') === 'jpg')
check('guessExt webp 带参数', guessExt('https://x/a.webp?x=1') === 'webp')
check('guessExt 无扩展回落 jpg', guessExt('https://x/a') === 'jpg')
check('makeImageName 去掉非字母数字', makeImageName('17/9?x') === 'rp_179x.jpg')
check('makeImageName 空种子', makeImageName('') === 'rp_0.jpg')

// ===== 代理 / 小图规则 =====
check('proxyResizeUrl 包裹原地址', proxyResizeUrl('https://a/b.jpg').indexOf('wsrv.nl/?url=') > 0)
check('proxyResizeUrl 不套娃', proxyResizeUrl('https://wsrv.nl/?url=x') === 'https://wsrv.nl/?url=x')
check('pixivSmallUrl 命中 img-master', pixivSmallUrl('https://i.pixiv.re/img-master/a.jpg') ===
  'https://i.pixiv.re/c/540x540_70/img-master/a.jpg')
check('pixivSmallUrl 其它路径不加工', pixivSmallUrl('https://x/a.jpg') === '')

// ===== 配置校验 =====
{
  const c = sanitizeConfig('yuki', { type: 'img' })
  check('sanitize 补默认值', c.size === 'regular' && c.proxy === 'i.pixiv.re', c)
  check('sanitize 保留已给值', c.type === 'img')
  check('sanitize 空串不覆盖', sanitizeConfig('yuki', { proxy: '' }).proxy === '')
  check('sanitize 未知源返回空', Object.keys(sanitizeConfig('setu', {})).length === 0)
  check('sourceName 中文名', sourceName('yuki') === 'Pixiv Yuki')
  check('sourceName 未知回显 id', sourceName('nope') === 'nope')
}

// ===== 落盘纯函数（persist.js）=====
{
  const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64')
  for (const s of ['', 'abc', '随机图片', '{"a":1}', 'emoji 🎨 ok', 'a'.repeat(5000)]) {
    check('b64enc 与标准实现一致 len=' + s.length, b64enc(s) === b64(s), b64enc(s).slice(0, 20))
  }

  const body = 'x'.repeat(9000)
  const cmds = shellWriteCmds('/userdisk/a.json', body, 6000)
  const parts = cmds.map((c) => (/printf '%s' '([^']*)'/.exec(c) || [])[1] || '')
  check('分段数量正确', parts.length === Math.ceil(b64(body).length / 6000), parts.length)
  check('每段长度是 4 的倍数', parts.every((p) => p.length % 4 === 0), parts.map((p) => p.length))
  check('首段覆盖写、后续追加', cmds[0].indexOf(' > ') > 0 && cmds[1].indexOf(' >> ') > 0)
  check('b64 拼接还原内容', Buffer.from(parts.join(''), 'base64').toString('utf8') === body)
  check('空内容走 : > 截断', shellWriteCmds('/tmp/a', '', 6000)[0] === ": > '/tmp/a'")
  check('路径含单引号要转义', shellQuote("a'b").indexOf("'\\''") > 0)

  check('normPath 合并双斜杠', normPath('/a//b//c/') === '/a/b/c')
  check('normPath 保留根', normPath('/') === '/')
  check('parentOf 正常', parentOf('/a/b/c.json') === '/a/b')
  check('parentOf 一层', parentOf('/a') === '/')

  const old = '{"cfg_yuki":{"proxy":"i.pixiv.re"},"save_dir":"favorite"}'
  const mo = JSON.parse(mergeCfgText(old, 'cfg_icatw', { source: '' }))
  check('合并保留原有键', mo.cfg_yuki && mo.cfg_yuki.proxy === 'i.pixiv.re')
  check('合并保留 save_dir', mo.save_dir === 'favorite')
  check('合并写入新键', !!mo.cfg_icatw)

  const bad = mergeCfgText('{"cfg_yuki":', 'save_dir', 'picture')
  check('坏 JSON 仍产出合法结果', (() => { try { JSON.parse(bad); return true } catch (e) { return false } })())
  check('坏 JSON 后仍写入新键', JSON.parse(bad).save_dir === 'picture')

  check('pickCfg 取到值', pickCfg(old, 'save_dir').value === 'favorite')
  check('pickCfg 缺键返回 found=false', pickCfg(old, 'nope').found === false)
  check('pickCfg 坏 JSON 不抛', pickCfg('{oops', 'a').found === false)

  check('文件成功即成功', saveVerdict(true, false).ok === true)
  check('只有镜像不算文件成功', saveVerdict(false, true).why === '仅镜像')
  check('都失败要报失败', saveVerdict(false, false).ok === false)
}

console.log('\n%d 通过, %d 失败', pass, fail)
process.exit(fail ? 1 : 0)
