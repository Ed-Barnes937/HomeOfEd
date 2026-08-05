import { BasePage } from '@hoe/test-kit'
import { expect } from '@playwright/experimental-ct-react'

import type { PlayedSample } from '../engine/testing/fakeAudioDriver.ts'
import { BOOP_AUDIO_DRIVER_KEY } from './gridProtocol.ts'

/** The root page object for boop's grid app — tap cells, play/pause, and drive the fake audio clock. */
export class HomePagePom extends BasePage {
  private readonly playButton = this.page.getByTestId('play-button')

  async verifyIsShown(): Promise<void> {
    await expect(this.page.getByText('boop', { exact: true })).toBeVisible()
    await expect(this.page.getByRole('application')).toBeVisible()
  }

  cell(instrumentId: string, step: number) {
    return this.page.getByTestId(`cell-${instrumentId}-${step}`)
  }

  async toggleCell(instrumentId: string, step: number): Promise<void> {
    await this.cell(instrumentId, step).click()
  }

  async verifyCellOn(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toHaveAttribute('data-active', 'true')
  }

  async verifyCellOff(instrumentId: string, step: number): Promise<void> {
    await expect(this.cell(instrumentId, step)).toHaveAttribute('data-active', 'false')
  }

  async pressPlay(): Promise<void> {
    await this.playButton.click()
  }

  async verifyPlaying(): Promise<void> {
    await expect(this.playButton).toHaveAttribute('aria-pressed', 'true')
  }

  async verifyPaused(): Promise<void> {
    await expect(this.playButton).toHaveAttribute('aria-pressed', 'false')
  }

  /** Fire one scheduled step on the in-page FakeAudioDriver's hand-cranked clock. */
  async fireStep(): Promise<void> {
    await this.page.evaluate((key) => {
      const driver = (globalThis as unknown as Record<string, { fireStep: () => void }>)[key]!
      driver.fireStep()
    }, BOOP_AUDIO_DRIVER_KEY)
  }

  /** Assert the samples the fake driver has been told to play, in call order. */
  async verifyPlayed(expected: PlayedSample[]): Promise<void> {
    const played = await this.page.evaluate((key) => {
      const driver = (globalThis as unknown as Record<string, { played: PlayedSample[] }>)[key]!
      return driver.played
    }, BOOP_AUDIO_DRIVER_KEY)
    expect(played).toEqual(expected)
  }
}
