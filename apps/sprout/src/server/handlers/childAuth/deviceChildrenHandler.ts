import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { PresetName } from '../../domain/presets.ts'
import type { SproutStore } from '../../store.ts'

export const deviceChildrenInputSchema = z.object({
  deviceToken: z.string().min(1),
})
export type DeviceChildrenInput = z.infer<typeof deviceChildrenInputSchema>

export interface DeviceChildSummary {
  id: string
  displayName: string
  presetName: PresetName
}

export interface DeviceChildrenResult {
  children: DeviceChildSummary[]
}

/**
 * childAuth.deviceChildren — the device-picker screen: which children are
 * registered on this device? PUBLIC: a device token, not a session, is the
 * bearer here — the picker runs before any child has authenticated. An
 * unregistered device token returns an empty list rather than an error.
 */
export class DeviceChildrenHandler extends Handler<
  DeviceChildrenInput,
  DeviceChildrenResult,
  SproutStore
> {
  async run(
    input: DeviceChildrenInput,
    ctx: AppContext<SproutStore>,
  ): Promise<DeviceChildrenResult> {
    const device = await ctx.store.getDeviceByToken(input.deviceToken)
    if (!device) return { children: [] }

    const rows = await ctx.store.listChildrenByParent(device.parentId)
    return {
      children: rows.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        presetName: c.presetName as PresetName,
      })),
    }
  }
}
