// Compatibility identifiers are kept here so released installs can upgrade in place.
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { brandName, PRODUCT_NAME } from './start/brand.mjs'

export { PRODUCT_NAME }
export const SHELL_DATA_NAME = 'DS Bot'
export const APP_ID = 'io.github.fei2411.dsbot'
export const LEGACY_PRODUCT_NAME = 'DeepSeek Bot'
export const LEGACY_ENGINE = 'deepseek-bot-engine'
export const LEGACY_ARTIFACT_PREFIX = 'DeepSeek-Bot'

/** Keep the shell data and Chromium encryption identity of an existing installation. */
export function configureIdentity(app, { env = process.env, platform = process.platform, exists = existsSync, mkdir = mkdirSync } = {}) {
  const explicit = env.DS_BOT_SHELL_DATA
  const isolated = explicit || env.DS_BOT_HOME
  const selected = app.getPath('userData')
  // The new display name must not move an installed profile, nor create a fresh empty one.
  // Explicit test/development homes keep Electron's selected, isolated shell directory.
  const current = !isolated && selected === join(app.getPath('appData'), PRODUCT_NAME)
    ? join(app.getPath('appData'), SHELL_DATA_NAME) : selected
  // An explicitly isolated run must never discover an installed application.
  const legacy = isolated ? undefined : join(app.getPath('appData'), LEGACY_PRODUCT_NAME)
  const reuse = legacy !== undefined && exists(legacy) && !exists(join(current, 'locations.json'))
  const userData = explicit || (reuse ? legacy : current)
  mkdir(userData, { recursive: true })
  app.setPath('userData', userData)
  app.setPath('sessionData', userData)
  if (platform === 'win32') app.setAppUserModelId(APP_ID)
  // Electron 44 captures this name for OSCrypt before ready. Restore the visible name
  // before creating menus or windows; the captured keychain identity stays unchanged.
  if (platform !== 'win32') app.setName(reuse ? LEGACY_PRODUCT_NAME : SHELL_DATA_NAME)
  app.once('ready', () => { app.setName(brandName(app.getLocale?.())) })
  return { userData, legacy: reuse }
}
