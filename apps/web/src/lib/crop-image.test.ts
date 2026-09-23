import { describe, expect, it } from 'vitest'
import { outputSize } from './crop-image'

describe('outputSize', () => {
  it('keeps a small crop', () => {
    expect(outputSize(800, 500)).toEqual({ width: 800, height: 500 })
  })

  it('caps the long edge at 1600', () => {
    expect(outputSize(3200, 1600)).toEqual({ width: 1600, height: 800 })
  })
})
