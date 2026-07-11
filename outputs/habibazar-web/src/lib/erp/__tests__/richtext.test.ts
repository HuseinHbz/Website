import { describe, it, expect } from 'vitest'
import { sanitizeRichHtml, looksLikeHtml } from '@/lib/erp/richtext'

describe('sanitizeRichHtml (contract body — Phase 26.10)', () => {
  it('keeps allowlisted formatting tags', () => {
    const out = sanitizeRichHtml('<p>Hello <b>bold</b> <i>italic</i> <u>under</u></p>')
    expect(out).toBe('<p>Hello <b>bold</b> <i>italic</i> <u>under</u></p>')
  })

  it('strips <script> entirely (tag + content)', () => {
    const out = sanitizeRichHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('alert')
    expect(out).toContain('<p>ok</p>')
  })

  it('strips <style>, <iframe>, <object>, <embed>, <svg>, <math>', () => {
    for (const tag of ['style', 'iframe', 'object', 'embed', 'svg', 'math']) {
      const out = sanitizeRichHtml(`<p>a</p><${tag}>x</${tag}><p>b</p>`)
      expect(out).not.toContain(`<${tag}`)
      expect(out).toContain('<p>a</p>')
      expect(out).toContain('<p>b</p>')
    }
  })

  it('drops event-handler attributes (onerror/onclick/onload)', () => {
    const out = sanitizeRichHtml('<p onclick="steal()" onmouseover="x()">t</p>')
    expect(out).toBe('<p>t</p>')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('onmouseover')
  })

  it('drops href/src (no links or images survive)', () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a><img src="x" onerror="y()">')
    // <a> and <img> are not allowlisted → dropped, inner text kept
    expect(out).not.toContain('href')
    expect(out).not.toContain('src')
    expect(out).not.toContain('javascript')
    expect(out).toContain('x')
  })

  it('neutralises javascript: even in surviving text', () => {
    const out = sanitizeRichHtml('<p>javascript:alert(1)</p>')
    expect(out).not.toContain('javascript:')
  })

  it('drops disallowed tags but keeps their text content', () => {
    const out = sanitizeRichHtml('<marquee>run</marquee><table><tr><td>cell</td></tr></table>')
    expect(out).not.toContain('<marquee')
    expect(out).not.toContain('<table')
    expect(out).toContain('run')
    expect(out).toContain('cell')
  })

  it('keeps only allowlisted style declarations, dropping the rest', () => {
    const out = sanitizeRichHtml('<p style="text-align: right; color: #cc0000; position: fixed; background: url(x)">t</p>')
    expect(out).toContain('text-align: right')
    expect(out).toContain('color: #cc0000')
    expect(out).not.toContain('position')
    expect(out).not.toContain('background')
    expect(out).not.toContain('url(')
  })

  it('rejects malformed style values (font-size injection)', () => {
    const out = sanitizeRichHtml('<span style="font-size: 14px; font-size: 99px)malicious">x</span>')
    expect(out).toContain('font-size: 14px')
    expect(out).not.toContain('malicious')
  })

  it('supports direction/text-align for RTL contract paragraphs', () => {
    const out = sanitizeRichHtml('<p style="direction: rtl; text-align: right">قرارداد</p>')
    expect(out).toContain('direction: rtl')
    expect(out).toContain('text-align: right')
    expect(out).toContain('قرارداد')
  })

  it('handles headings, lists and blockquotes', () => {
    const out = sanitizeRichHtml('<h2>Title</h2><ul><li>one</li><li>two</li></ul><blockquote>q</blockquote>')
    expect(out).toContain('<h2>Title</h2>')
    expect(out).toContain('<li>one</li>')
    expect(out).toContain('<blockquote>q</blockquote>')
  })

  it('empty / non-html input is safe', () => {
    expect(sanitizeRichHtml('')).toBe('')
    expect(sanitizeRichHtml('plain text')).toBe('plain text')
  })

  it('looksLikeHtml distinguishes markup from plain text', () => {
    expect(looksLikeHtml('<p>x</p>')).toBe(true)
    expect(looksLikeHtml('just words')).toBe(false)
  })
})
