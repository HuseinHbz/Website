import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'zlib'
import { parseXlsx, xlsxToMatrix, isXlsx, colIndex, decodeXmlEntities } from '@/lib/import/xlsx'
import { latinDigits, normalizePhone, normalizeEmail, normalizeNationalCode, normalizeNumberText, cleanseRecord } from '@/lib/import/cleanse'
import {
  stockState, canHold, canIssueDirect, canTransitionShipment, shipmentIssuesStock, shipmentReturnsStock,
  canTransitionCount, countVariances, economicOrderQty, inventoryAdjustmentPostingLines,
} from '../stockOps'
import {
  abcAnalysis, coefficientOfVariation, xyzClass, movementClass, agingBucket,
  turnoverRatio, expiryStatus, nearExpiry, reorderSuggestions, intelligenceKpis,
} from '../intelligence'
import { isValidImei, isValidSerial, canTransitionSerial, warrantyStatus, isValidBatchNo, batchDatesValid, recallPlan } from '../serials'
import { eanCheckDigit, isValidEan13, ean13Normalize, ean13Svg } from '@/lib/erp/barcode'
import { postingBalanced } from '@/lib/erp/sales'

// ── Minimal ZIP writer (test fixture only) ───────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function buildZip(files: { name: string; content: string; deflate?: boolean }[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const raw = Buffer.from(f.content, 'utf8')
    const data = f.deflate ? deflateRawSync(raw) : raw
    const name = Buffer.from(f.name, 'utf8')
    const crc = crc32(raw)
    const method = f.deflate ? 8 : 0
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(method, 8)
    lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22)
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28)
    const local = Buffer.concat([lh, name, data])
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8)
    ch.writeUInt16LE(method, 10); ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20)
    ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([ch, name]))
    locals.push(local)
    offset += local.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

function fixtureXlsx(opts: { deflate?: boolean } = {}): Buffer {
  const d = opts.deflate ?? false
  return buildZip([
    { name: 'xl/workbook.xml', deflate: d, content: `<workbook><sheets><sheet name="Data" sheetId="1" r:id="rId1"/><sheet name="گزارش" sheetId="2" r:id="rId2"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', deflate: d, content: `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>` },
    { name: 'xl/sharedStrings.xml', deflate: d, content: `<sst><si><t>sku</t></si><si><t>نام کالا</t></si><si><t xml:space="preserve"> padded </t></si><si><r><t>Rich</t></r><r><t> Text</t></r></si><si><t>A &amp; B &lt;C&gt;</t></si></sst>` },
    { name: 'xl/worksheets/sheet1.xml', deflate: d, content: `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>qty</t></is></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>42.5</v></c></row><row r="3"><c r="A3" t="b"><v>1</v></c><c r="C3"><f>SUM(C2)</f><v>42.5</v></c></row></sheetData></worksheet>` },
    { name: 'xl/worksheets/sheet2.xml', deflate: d, content: `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>2</v></c></row></sheetData></worksheet>` },
  ])
}

describe('XLSX native parser (zero-dep)', () => {
  it('detects the ZIP magic', () => {
    expect(isXlsx(fixtureXlsx())).toBe(true)
    expect(isXlsx(Buffer.from('sku,name\n1,2'))).toBe(false)
  })
  it('parses a STORE-compressed workbook into matrices', () => {
    const wb = parseXlsx(fixtureXlsx())
    expect(wb.sheets.map(s => s.name)).toEqual(['Data', 'گزارش'])
    expect(wb.sheets[0].matrix[0]).toEqual(['sku', 'نام کالا', 'qty'])
  })
  it('parses a DEFLATE-compressed workbook identically', () => {
    const wb = parseXlsx(fixtureXlsx({ deflate: true }))
    expect(wb.sheets[0].matrix[0]).toEqual(['sku', 'نام کالا', 'qty'])
  })
  it('reads shared strings incl. Persian, rich text, xml:space and entities', () => {
    const m = parseXlsx(fixtureXlsx()).sheets[0].matrix
    expect(m[1][0]).toBe('Rich Text')
    expect(m[1][1]).toBe('A & B <C>')
  })
  it('reads numbers, booleans and cached formula values; fills sparse cells', () => {
    const m = parseXlsx(fixtureXlsx()).sheets[0].matrix
    expect(m[1][2]).toBe('42.5')
    expect(m[2][0]).toBe('true')
    expect(m[2][1]).toBe('') // sparse gap filled
    expect(m[2][2]).toBe('42.5') // cached <v> of the formula, not the formula
  })
  it('supports multiple sheets + selection by name (Persian sheet name)', () => {
    const r = xlsxToMatrix(fixtureXlsx(), 'گزارش')
    expect(r.sheetNames).toEqual(['Data', 'گزارش'])
    expect(r.matrix[0][0]).toBe(' padded ')
  })
  it('defaults to the first sheet and rejects unknown sheet names', () => {
    expect(xlsxToMatrix(fixtureXlsx()).sheet).toBe('Data')
    expect(() => xlsxToMatrix(fixtureXlsx(), 'Nope')).toThrow(/not found/)
  })
  it('rejects non-zip garbage', () => {
    expect(() => parseXlsx(Buffer.from('PK garbage but not really a zip file at all'))).toThrow()
  })
  it('colIndex converts A/Z/AA/BC', () => {
    expect(colIndex('A1')).toBe(0)
    expect(colIndex('Z9')).toBe(25)
    expect(colIndex('AA10')).toBe(26)
    expect(colIndex('BC12')).toBe(54)
  })
  it('decodes numeric XML entities', () => {
    expect(decodeXmlEntities('&#x62A;&#1587;&#x62A;')).toBe('تست')
  })
})

describe('cleansing / normalization', () => {
  it('converts Persian and Arabic-Indic digits', () => {
    expect(latinDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789')
    expect(latinDigits('٠١٢٣')).toBe('0123')
  })
  it('normalizes Iranian phone formats to canonical 0-leading', () => {
    expect(normalizePhone('+98 912 345 6789')).toBe('09123456789')
    expect(normalizePhone('0098-912-345-6789')).toBe('09123456789')
    expect(normalizePhone('989123456789')).toBe('09123456789')
    expect(normalizePhone('9123456789')).toBe('09123456789')
    expect(normalizePhone('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('09123456789')
  })
  it('leaves non-phone text intact (trimmed)', () => {
    expect(normalizePhone(' n/a ')).toBe('n/a')
  })
  it('normalizes email case/space and national code padding', () => {
    expect(normalizeEmail('  Ali@Example.COM ')).toBe('ali@example.com')
    expect(normalizeNationalCode('84575948')).toBe('0084575948')
    expect(normalizeNationalCode('۰۰۸۴۵۷۵۹۴۸')).toBe('0084575948')
  })
  it('normalizes Persian number separators', () => {
    expect(normalizeNumberText('۱٬۲۳۴٫۵')).toBe('1,234.5')
  })
  it('cleanseRecord routes by field name', () => {
    const out = cleanseRecord({ phone: '+98 912 000 1111', email: ' X@Y.Z ', nationalId: '۱۲۳', creditLimit: '۱٬۰۰۰', name: '  Acme ' })
    expect(out.phone).toBe('09120001111')
    expect(out.email).toBe('x@y.z')
    expect(out.nationalId).toBe('0000000123')
    expect(out.creditLimit).toBe('1,000')
    expect(out.name).toBe('Acme')
  })
})

describe('stock states + holds', () => {
  const holds = [
    { kind: 'reserve' as const, qty: 10, status: 'active' as const },
    { kind: 'block' as const, qty: 5, status: 'active' as const },
    { kind: 'damage' as const, qty: 2, status: 'active' as const },
    { kind: 'reserve' as const, qty: 99, status: 'released' as const },
  ]
  it('computes the state breakdown (released holds ignored)', () => {
    const s = stockState(100, holds, 7)
    expect(s).toEqual({ onHand: 100, reserved: 10, blocked: 5, damaged: 2, inTransit: 7, available: 83 })
  })
  it('available never goes negative', () => {
    expect(stockState(5, [{ kind: 'reserve', qty: 50, status: 'active' }]).available).toBe(0)
  })
  it('canHold enforces available stock', () => {
    const s = stockState(100, holds)
    expect(canHold(s, 83).ok).toBe(true)
    expect(canHold(s, 84).ok).toBe(false)
    expect(canHold(s, 0).ok).toBe(false)
  })
  it('canIssueDirect (RULE-012) blocks a direct issue/transfer-out that would take on-hand negative', () => {
    expect(canIssueDirect(10, 10).ok).toBe(true)   // exact remaining stock
    expect(canIssueDirect(10, 11).ok).toBe(false)  // would go negative
    expect(canIssueDirect(0, 1).ok).toBe(false)    // nothing on hand
    expect(canIssueDirect(10, 0).ok).toBe(false)   // zero qty is never a legal move
  })
})

describe('shipment lifecycle', () => {
  it('follows draft→picking→packed→shipped→delivered', () => {
    expect(canTransitionShipment('draft', 'picking')).toBe(true)
    expect(canTransitionShipment('picking', 'packed')).toBe(true)
    expect(canTransitionShipment('packed', 'shipped')).toBe(true)
    expect(canTransitionShipment('shipped', 'delivered')).toBe(true)
  })
  it('cannot skip packing or ship twice', () => {
    expect(canTransitionShipment('picking', 'shipped')).toBe(false)
    expect(canTransitionShipment('delivered', 'shipped')).toBe(false)
  })
  it('stock is issued exactly at packed→shipped and returned on returns', () => {
    expect(shipmentIssuesStock('packed', 'shipped')).toBe(true)
    expect(shipmentIssuesStock('draft', 'picking')).toBe(false)
    expect(shipmentReturnsStock('delivered', 'returned')).toBe(true)
    expect(shipmentReturnsStock('packed', 'shipped')).toBe(false)
  })
})

describe('cycle count', () => {
  it('lifecycle: draft→counting→submitted→approved→posted; no skipping approval', () => {
    expect(canTransitionCount('draft', 'counting')).toBe(true)
    expect(canTransitionCount('counting', 'submitted')).toBe(true)
    expect(canTransitionCount('submitted', 'approved')).toBe(true)
    expect(canTransitionCount('approved', 'posted')).toBe(true)
    expect(canTransitionCount('submitted', 'posted')).toBe(false)
    expect(canTransitionCount('posted', 'counting')).toBe(false)
  })
  it('countVariances returns only real differences', () => {
    const v = countVariances([
      { productId: 1, systemQty: 10, countedQty: 8 },
      { productId: 2, systemQty: 5, countedQty: 5 },
      { productId: 3, systemQty: 0, countedQty: 3 },
      { productId: 4, systemQty: 9, countedQty: null },
    ])
    expect(v).toEqual([{ productId: 1, variance: -2 }, { productId: 3, variance: 3 }])
  })
})

describe('EOQ + adjustment posting', () => {
  it('computes the classic EOQ', () => {
    // √(2·1000·50 / 2) = √50000 ≈ 224
    expect(economicOrderQty(1000, 50, 2)).toBe(224)
  })
  it('returns 0 on non-positive inputs', () => {
    expect(economicOrderQty(0, 50, 2)).toBe(0)
    expect(economicOrderQty(1000, 0, 2)).toBe(0)
  })
  it('adjustment posting balances both directions', () => {
    const up = inventoryAdjustmentPostingLines(500)
    expect(up.find(l => l.accountCode === '1200')!.debit).toBe(500)
    expect(postingBalanced(up)).toBe(true)
    const down = inventoryAdjustmentPostingLines(-300)
    expect(down.find(l => l.accountCode === '5000')!.debit).toBe(300)
    expect(postingBalanced(down)).toBe(true)
    expect(inventoryAdjustmentPostingLines(0)).toEqual([])
  })
})

describe('stock intelligence', () => {
  it('ABC by cumulative value share', () => {
    const cls = abcAnalysis([
      { id: 1, value: 800 }, { id: 2, value: 150 }, { id: 3, value: 30 }, { id: 4, value: 20 },
    ])
    expect(cls.get(1)).toBe('A')
    expect(cls.get(2)).toBe('B')
    expect(cls.get(3)).toBe('C')
    expect(cls.get(4)).toBe('C')
  })
  it('a single dominant item is class A even when it alone crosses 80% (live-PG regression)', () => {
    const cls = abcAnalysis([{ id: 1, value: 21450 }, { id: 2, value: 1000 }, { id: 3, value: 1000 }])
    expect(cls.get(1)).toBe('A')
  })
  it('XYZ by demand variability', () => {
    expect(xyzClass([10, 10, 10, 10])).toBe('X')       // cv 0
    expect(xyzClass([10, 30, 5, 15])).toBe('Y')        // cv ≈ 0.62 moderate
    expect(xyzClass([0, 0, 40, 0])).toBe('Z')          // erratic
    expect(coefficientOfVariation([])).toBe(Infinity)
  })
  it('movement classes fast/slow/dead', () => {
    expect(movementClass({ annualIssueQty: 50, lastMoveDaysAgo: 3, onHand: 10 })).toBe('fast')
    expect(movementClass({ annualIssueQty: 4, lastMoveDaysAgo: 30, onHand: 10 })).toBe('slow')
    expect(movementClass({ annualIssueQty: 0, lastMoveDaysAgo: 400, onHand: 10 })).toBe('dead')
    expect(movementClass({ annualIssueQty: 0, lastMoveDaysAgo: null, onHand: 5 })).toBe('dead')
  })
  it('aging buckets', () => {
    expect(agingBucket(10)).toBe('0-30')
    expect(agingBucket(91)).toBe('91-180')
    expect(agingBucket(400)).toBe('365+')
  })
  it('turnover ratio', () => {
    expect(turnoverRatio(120, 30)).toBe(4)
    expect(turnoverRatio(120, 0)).toBe(0)
  })
  it('expiry status + near-expiry filter', () => {
    expect(expiryStatus('2026-07-10', '2026-07-13')).toBe('expired')
    expect(expiryStatus('2026-07-30', '2026-07-13')).toBe('near')
    expect(expiryStatus('2027-01-01', '2026-07-13')).toBe('ok')
    expect(expiryStatus(null, '2026-07-13')).toBe('none')
    const near = nearExpiry([
      { id: 1, expiryDate: '2026-07-20', qtyRemaining: 5 },
      { id: 2, expiryDate: '2026-07-20', qtyRemaining: 0 },
      { id: 3, expiryDate: '2027-07-20', qtyRemaining: 9 },
    ], '2026-07-13')
    expect(near.map(b => b.id)).toEqual([1])
  })
  it('reorder suggestions rank the most-depleted first and use EOQ', () => {
    const facts = [
      { id: 1, sku: 'A', name: 'A', onHand: 1, value: 0, annualIssueQty: 100, monthlyIssues: [], lastMoveDaysAgo: 1, reorderPoint: 10, safetyStock: 2, maxStock: 0 },
      { id: 2, sku: 'B', name: 'B', onHand: 9, value: 0, annualIssueQty: 100, monthlyIssues: [], lastMoveDaysAgo: 1, reorderPoint: 10, safetyStock: 2, maxStock: 50 },
      { id: 3, sku: 'C', name: 'C', onHand: 99, value: 0, annualIssueQty: 100, monthlyIssues: [], lastMoveDaysAgo: 1, reorderPoint: 10, safetyStock: 2, maxStock: 0 },
    ]
    const s = reorderSuggestions(facts, f => (f.id === 1 ? 224 : 0))
    expect(s.map(x => x.id)).toEqual([1, 2])
    expect(s[0].suggestedQty).toBe(224) // EOQ wins
    expect(s[1].suggestedQty).toBe(41)  // to max stock
  })
  it('intelligence KPI rollup', () => {
    const k = intelligenceKpis([
      { value: 100, abc: 'A', movement: 'fast', belowReorder: true, turnover: 4 },
      { value: 50, abc: 'C', movement: 'dead', belowReorder: false, turnover: 0 },
    ], 3)
    expect(k.products).toBe(2)
    expect(k.totalValue).toBe(150)
    expect(k.aCount).toBe(1)
    expect(k.deadCount).toBe(1)
    expect(k.belowReorder).toBe(1)
    expect(k.nearExpiryCount).toBe(3)
    expect(k.avgTurnover).toBe(2)
  })
})

describe('serial / batch / IMEI', () => {
  it('validates IMEI with the Luhn check digit', () => {
    expect(isValidImei('490154203237518')).toBe(true)  // classic valid IMEI
    expect(isValidImei('490154203237519')).toBe(false)
    expect(isValidImei('12345')).toBe(false)
    expect(isValidImei(null)).toBe(false)
  })
  it('validates serial + batch formats', () => {
    expect(isValidSerial('SN-2026.001_X')).toBe(true)
    expect(isValidSerial('a b')).toBe(false)
    expect(isValidBatchNo('LOT/2026-07')).toBe(true)
    expect(isValidBatchNo('')).toBe(false)
  })
  it('serial lifecycle transitions', () => {
    expect(canTransitionSerial('in_stock', 'reserved')).toBe(true)
    expect(canTransitionSerial('reserved', 'sold')).toBe(true)
    expect(canTransitionSerial('sold', 'returned')).toBe(true)
    expect(canTransitionSerial('returned', 'in_stock')).toBe(true)
    expect(canTransitionSerial('in_stock', 'returned')).toBe(false)
    expect(canTransitionSerial('recalled', 'in_stock')).toBe(false)
  })
  it('warranty state incl. expiring window', () => {
    expect(warrantyStatus('2026-01-13', 12, '2026-07-13')).toBe('active')
    expect(warrantyStatus('2025-07-20', 12, '2026-07-13')).toBe('expiring')
    expect(warrantyStatus('2024-01-01', 12, '2026-07-13')).toBe('expired')
    expect(warrantyStatus(null, 12, '2026-07-13')).toBe('none')
  })
  it('batch dates must be ordered', () => {
    expect(batchDatesValid({ batchNo: 'L1', productionDate: '2026-01-01', expiryDate: '2027-01-01' })).toBe(true)
    expect(batchDatesValid({ batchNo: 'L1', productionDate: '2027-01-01', expiryDate: '2026-01-01' })).toBe(false)
  })
  it('recall plan covers every recallable serial', () => {
    const plan = recallPlan([
      { id: 1, status: 'in_stock' }, { id: 2, status: 'sold' }, { id: 3, status: 'recalled' },
    ])
    expect(plan.map(p => p.id)).toEqual([1, 2])
  })
})

describe('EAN-13', () => {
  it('computes the GS1 check digit', () => {
    expect(eanCheckDigit('400638133393')).toBe(1) // 4006381333931
    expect(eanCheckDigit('590123412345')).toBe(7) // 5901234123457
  })
  it('validates and normalizes', () => {
    expect(isValidEan13('4006381333931')).toBe(true)
    expect(isValidEan13('4006381333932')).toBe(false)
    expect(ean13Normalize('400638133393')).toBe('4006381333931')
    expect(ean13Normalize('abc')).toBeNull()
  })
  it('renders a self-contained SVG with 95 modules', () => {
    const svg = ean13Svg('4006381333931', { moduleWidth: 1, showText: false })
    expect(svg).toContain('<svg')
    expect(svg).toContain('width="95"')
    expect(ean13Svg('123')).toBeNull()
  })
})
