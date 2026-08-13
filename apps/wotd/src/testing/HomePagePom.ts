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

  async verifyWordType(wordType: string): Promise<void> {
    await expect(this.page.getByTestId('wotd-word-type')).toHaveText(wordType)
  }

  async verifyRespelling(respelling: string): Promise<void> {
    await expect(this.page.getByTestId('wotd-respelling')).toHaveText(respelling)
  }

  /** Asserts neither type nor respelling is rendered (pre-redesign rows). */
  async verifyNoWordTypeOrRespelling(): Promise<void> {
    await expect(this.page.getByTestId('wotd-word-type')).toHaveCount(0)
    await expect(this.page.getByTestId('wotd-respelling')).toHaveCount(0)
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
   * Asserts the level is wired through the word screen: the top-bar pill
   * carries the level and its number, and the page container binds the
   * level's palette (data-level) for the badge and primary button.
   */
  async verifyLevelColourCarryThrough(level: Difficulty, number: number): Promise<void> {
    const pill = this.page.getByTestId('level-pill')
    await expect(pill).toHaveAttribute('data-level', level)
    await expect(pill).toContainText(String(number))
    await expect(pill).toContainText(level)
    await expect(this.page.getByTestId('wotd-page')).toHaveAttribute('data-level', level)
    await expect(this.page.getByRole('button', { name: 'Show Definition' })).toBeVisible()
  }

  /**
   * Replaces `speechSynthesis.speak` with a recorder so the CT browser plays no
   * real audio, and stubs `cancel` (called before every speak). Utterances are
   * kept so tests can fire their start/end events. Call before clicking the
   * speak button.
   */
  async stubSpeech(): Promise<void> {
    await this.page.evaluate(() => {
      const spoken: string[] = []
      const utterances: SpeechSynthesisUtterance[] = []
      const win = window as unknown as {
        __spoken: string[]
        __utterances: SpeechSynthesisUtterance[]
      }
      win.__spoken = spoken
      win.__utterances = utterances
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        spoken.push(u.text)
        utterances.push(u)
      }
      window.speechSynthesis.cancel = () => {}
    })
  }

  /** Removes the Web Speech API so `speechSupported()` reports false. */
  async disableSpeech(): Promise<void> {
    await this.page.evaluate(() => {
      delete (Window.prototype as { speechSynthesis?: unknown }).speechSynthesis
      delete (window as { speechSynthesis?: unknown }).speechSynthesis
    })
  }

  async verifySpeakAbsent(): Promise<void> {
    await expect(this.page.getByTestId('wotd-speak')).toHaveCount(0)
  }

  /** Fires the last stubbed utterance's start event (playback has begun). */
  async beginPlayback(): Promise<void> {
    await this.page.evaluate(() => {
      const u = (window as unknown as { __utterances: SpeechSynthesisUtterance[] }).__utterances.at(-1)
      u?.onstart?.(new Event('start') as SpeechSynthesisEvent)
    })
  }

  /** Fires the last stubbed utterance's end event (playback has finished). */
  async finishPlayback(): Promise<void> {
    await this.page.evaluate(() => {
      const u = (window as unknown as { __utterances: SpeechSynthesisUtterance[] }).__utterances.at(-1)
      u?.onend?.(new Event('end') as SpeechSynthesisEvent)
    })
  }

  /** Asserts whether the hear-it button is in its playing state. */
  async verifyPlayingState(playing: boolean): Promise<void> {
    const button = this.page.getByTestId('wotd-speak')
    if (playing) {
      await expect(button).toHaveAttribute('data-playing', 'true')
    } else {
      await expect(button).not.toHaveAttribute('data-playing')
    }
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

  /** Clicks the sun/moon pill in the top bar. */
  async toggleTheme(): Promise<void> {
    await this.page.getByTestId('theme-toggle').click()
  }

  /** Asserts the document root is painted with the given theme. */
  async verifyTheme(theme: 'light' | 'dark'): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe(theme)
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
