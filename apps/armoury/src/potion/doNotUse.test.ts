import { describe, expect, it } from 'vitest'

import { isForbiddenName, POTION_DO_NOT_USE } from './doNotUse.ts'

describe('isForbiddenName', () => {
  it('catches every list entry in any case and spacing', () => {
    for (const entry of POTION_DO_NOT_USE) {
      expect(isForbiddenName(entry), entry).toBe(true)
      expect(isForbiddenName(entry.toUpperCase()), entry).toBe(true)
      const spaced = ` ${entry.toLowerCase().replace(/[^a-z0-9]+/g, '  ')} `
      expect(isForbiddenName(spaced), entry).toBe(true)
    }
  })

  it('catches the spec examples', () => {
    for (const name of [
      'Thunder Brew',
      'potion of swiftness',
      'Hi-Potion',
      'X Potion',
      'Philter',
    ]) {
      expect(isForbiddenName(name), name).toBe(true)
    }
  })

  it('catches the patterns', () => {
    for (const name of [
      'Potion of Anything',
      'Draught of Giggles',
      'ELIXIR OF Rain',
      'Philter of Friends',
      'Super Potion',
      'Hyper-Potion',
      'Max   Potion',
      'MegaPotion',
      'Hi Potion',
      'X-potion',
    ]) {
      expect(isForbiddenName(name), name).toBe(true)
    }
  })

  it('catches a listed entry as a run of words inside a longer name, however short', () => {
    for (const name of [
      'Polyjuice Tonic',
      'Sparkling Butterbeer Brew',
      'Pepperup Tonic',
      'Skele-Gro Drops',
      'Drink Me Potion',
      'Ambrosia Brew',
      'Skooma Mixture',
      'Tawny Owl Brew',
      'Swallow Tonic',
    ]) {
      expect(isForbiddenName(name), name).toBe(true)
    }
  })

  it('lets ordinary names through', () => {
    for (const name of [
      'Floating Frogfizz Tonic',
      'Pure Starpetal',
      'An Empty Bottle',
      'Whiffy Bogmurk Brew',
      'Sea Glass',
      'Bluebell Dew Potion',
      'Together',
      'Chi Potion',
      'Somatic Drops',
      'Thundercloud Mixture',
      'Bored Potion',
      'Sacred Potion',
      'Climax Potion',
      'Chipotion',
      'Elixir Garden',
    ]) {
      expect(isForbiddenName(name), name).toBe(false)
    }
  })

  it('catches Elixir only as a whole name', () => {
    expect(isForbiddenName('Elixir')).toBe(true)
    expect(isForbiddenName('Rose Elixir')).toBe(false)
  })
})
