import type { Page } from '@playwright/test'

/**
 * Base Page Object Model. App page objects extend this and expose intent-level
 * actions/assertions; .iwft tests drive the UI only through them.
 */
export abstract class BasePage {
  protected readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Assert the page object's root is visible — call after navigation/mount. */
  abstract verifyIsShown(): Promise<void>
}
