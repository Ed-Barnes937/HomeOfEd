import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'
import type { Locator } from '@playwright/test'

import type { Difficulty } from '../server/wordGenerator.ts'

/** Age-hint copy shown on each level card — mirrors LevelCard.tsx. */
const KS_HINT: Record<Difficulty, string> = {
  beginner: 'Typically KS1',
  intermediate: 'Typically KS2',
  advanced: 'Typically KS3',
  expert: 'Typically KS4',
}

export class HomePagePom extends BasePage {
  private levelCard(level: Difficulty): Locator {
    return this.page.getByTestId(`level-card-${level}`)
  }

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByTestId('home-page')).toBeVisible()
    await expect(this.page.getByRole('heading', { name: 'Pick a level, any level!' })).toBeVisible()
  }

  /** Asserts a level card is visible with its age (key-stage) hint. */
  async verifyLevelCard(level: Difficulty): Promise<void> {
    const card = this.levelCard(level)
    await expect(card).toBeVisible()
    await expect(card).toContainText(KS_HINT[level])
  }

  async clickLevel(level: Difficulty): Promise<void> {
    await this.levelCard(level).click()
  }

  async verifyWotdPageIsShown(): Promise<void> {
    await expect(this.page.getByTestId('wotd-page')).toBeVisible()
  }

  /** Clicks the back link on the word page to return to the level picker. */
  async clickBack(): Promise<void> {
    await this.page.getByTestId('wotd-back').click()
  }

  async verifyWord(word: string): Promise<void> {
    await expect(this.page.getByTestId('wotd-word')).toHaveText(word)
  }

  async verifyDefinition(definition: string): Promise<void> {
    await expect(this.page.getByTestId('wotd-definition')).toContainText(definition)
  }

  async verifySentence(sentence: string): Promise<void> {
    await expect(this.page.getByTestId('wotd-sentence')).toContainText(sentence)
  }

  async verifySynonyms(synonyms: string[]): Promise<void> {
    const list = this.page.getByTestId('wotd-synonyms')
    for (const synonym of synonyms) {
      await expect(list).toContainText(synonym)
    }
  }

  /** Toggles the show/hide-definition button on the word card. */
  async toggleDefinition(): Promise<void> {
    await this.page.getByRole('button', { name: /Definition/ }).click()
  }

  async verifyDefinitionHidden(): Promise<void> {
    await expect(this.page.getByTestId('wotd-definition')).toHaveCount(0)
  }

  /**
   * Replaces `speechSynthesis.speak` with a recorder so the CT browser plays no
   * real audio, and stubs `cancel` (called before every speak). Call before
   * clicking the speak button.
   */
  async stubSpeech(): Promise<void> {
    await this.page.evaluate(() => {
      const spoken: string[] = []
      ;(window as unknown as { __spoken: string[] }).__spoken = spoken
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => spoken.push(u.text)
      window.speechSynthesis.cancel = () => {}
    })
  }

  async clickSpeak(): Promise<void> {
    await this.page.getByTestId('wotd-speak').click()
  }

  /** Asserts the word passed through the stubbed Web Speech API. */
  async verifySpoken(word: string): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken))
      .toContain(word)
  }

  /** Asserts the page has no horizontal overflow at the current viewport. */
  async verifyNoHorizontalOverflow(): Promise<void> {
    const overflow = await this.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  }

  /** Client-side navigate to a route (no reload); popstate drives the router. */
  async gotoPath(path: string): Promise<void> {
    await this.page.evaluate((p) => {
      window.history.pushState({}, '', p)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }
}
