// Sheet 26 (2026-11-09): the typing exam graded «مالك يوم الدين» (Arabic ك/ي) as wrong.
import { describe, it, expect } from 'vitest'
import { eq, eqWord, normAR, typedReachedTarget } from '../lib/arabic.js'

const UTHMANI = 'مَٰلِكِ يَوۡمِ ٱلدِّينِ'
const RASM_PLAIN = 'ملك يوم الدين'

describe('typing grade: letter variants (ك/ک، ي/ی/ى، ة/ه، أإآٱ/ا، اعراب، تطویل)', () => {
  it('Arabic and Persian kaf/yeh are the same letter', () => {
    expect(eq('مالك يوم الدين', 'مالک یوم الدین')).toBe(true)
    expect(eq('على', 'علی')).toBe(true)
    expect(eq('رحمة', 'رحمه')).toBe(true)
    expect(eq('أإآٱ', 'اااا')).toBe(true)
    expect(eq('الـــرحمن', 'الرحمن')).toBe(true)
    expect(eq('بِسۡمِ ٱللَّهِ', 'بسم الله')).toBe(true)
    expect(eq('مالك‌ يوم﻿ الدين', 'مالک یوم الدین')).toBe(true)
  })
  it('regression: «مالك يوم الدين» typed with Arabic ك/ي is CORRECT for every target spelling', () => {
    for (const typed of ['مالك يوم الدين', 'مالک یوم الدین', 'ملك يوم الدين']) {
      expect(eq(typed, UTHMANI)).toBe(true)
      expect(eq(typed, RASM_PLAIN)).toBe(true)
    }
    expect(eq('مالك يوم الدين', 'مالک یوم الدین')).toBe(true)
  })
  it('Uthmani words without the alef accept the ordinary spelling', () => {
    expect(eqWord('الرحمان', 'الرحمن')).toBe(true)
    expect(eqWord('الکتاب', 'ٱلۡكِتَٰبُ')).toBe(true)
    expect(eqWord('ذالک', 'ذَٰلِكَ')).toBe(true)
  })
  it('still strict: wrong words, missing alef, wrong word count', () => {
    expect(eq('مالك يوم القيامة', UTHMANI)).toBe(false)
    expect(eq('ملك يوم الدين', 'مالك يوم الدين')).toBe(false) // missing an alef the target HAS
    expect(eqWord('قل', 'قال')).toBe(false)
    expect(eq('مالك يوم', UTHMANI)).toBe(false)
    expect(eq('', UTHMANI)).toBe(false)
    expect(eqWord('اقرا', 'اقرأ')).toBe(true)
    expect(eqWord('امل', 'مال')).toBe(false)
  })
  it('normAR itself is unchanged for the old cases', () => {
    expect(normAR('مَالِكِ')).toBe('مالک')
  })
})

describe('typedReachedTarget: no «wrong» before the user finished typing', () => {
  it('a typed extra alef does not finish the word early', () => {
    expect(typedReachedTarget('مال', 'ملك')).toBe(false)
    expect(typedReachedTarget('مالك', 'ملك')).toBe(true)
    expect(typedReachedTarget('مالك يوم الدي', RASM_PLAIN)).toBe(false)
    expect(typedReachedTarget('مالك يوم الدبن', RASM_PLAIN)).toBe(true)
  })
  it('vowel marks of the target are not counted', () => {
    expect(typedReachedTarget('مال', 'مَٰلِكِ')).toBe(false)
    expect(typedReachedTarget('مالب', 'مَٰلِكِ')).toBe(true)
  })
})
