import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { compilePotion } from '../potion/compile.ts'
import { potionItem } from '../potion/item.ts'
import { PotionOutline } from './PotionOutline.tsx'

const drawn = (mixed: 'yes' | 'no') => {
  const params = { ...potionItem.firstVisit(), mixed }
  const html = renderToStaticMarkup(<PotionOutline params={params} />)
  return { html, colour: compilePotion(params).mix!.colour }
}

const liquidPaths = (html: string) => html.match(/<path d="[^"]*" fill="#/g) ?? []

describe('PotionOutline', () => {
  it('draws an unmixed potion as one band per ingredient', () => {
    const { html, colour } = drawn('no')
    expect(liquidPaths(html)).toHaveLength(3 + 1)
    expect(html).not.toContain(`fill="${colour}"`)
  })

  it('draws a mixed potion as one liquid path in the mixed colour', () => {
    const { html, colour } = drawn('yes')
    expect(html.match(new RegExp(`fill="${colour}"`, 'g'))).toHaveLength(1)
    expect(liquidPaths(html)).toHaveLength(1 + 1)
  })
})
