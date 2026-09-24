const { execFileSync } = require('child_process')
const path = require('path')

function run(file, args) {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000
    })
  } catch (error) {
    return { error, stdout: String(error.stdout || ''), stderr: String(error.stderr || '') }
  }
}

function inspectIntegrity(app) {
  const base = {
    version: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    appPath: app.getAppPath(),
    status: 'unknown',
    signed: false,
    validSignature: false,
    identity: null,
    teamIdentifier: null,
    hardenedRuntime: false,
    reason: null
  }

  if (process.platform !== 'darwin') {
    base.status = 'unsupported'
    base.reason = 'macOS code-signature verification is only available on macOS'
    return base
  }

  if (!app.isPackaged) {
    base.status = 'development'
    base.reason = 'Development builds are not evaluated as distributable releases'
    return base
  }

  const bundlePath = path.resolve(process.execPath, '..', '..')
  const verify = run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundlePath])

  if (verify && typeof verify === 'object' && verify.error) {
    const message = (verify.stderr || verify.stdout || verify.error.message || '').toString().trim()
    const display = run('/usr/bin/codesign', ['-dv', '--verbose=4', bundlePath])
    const details = typeof display === 'string'
      ? display
      : ((display.stderr || '') + (display.stdout || ''))

    if (/code object is not signed|not signed at all/i.test(message)) {
      base.status = 'unsigned'
      base.reason = message || 'Application is not code signed'
      return base
    }

    base.status = 'modified'
    base.signed = true
    base.validSignature = false
    base.reason = message || 'Code signature verification failed'
    base.identity = details.match(/Authority=(.+)/)?.[1] || null
    base.teamIdentifier = details.match(/TeamIdentifier=(.+)/)?.[1] || null
    return base
  }

  const display = run('/usr/bin/codesign', ['-dv', '--verbose=4', bundlePath])
  const details = typeof display === 'string'
    ? display
    : ((display.stderr || '') + (display.stdout || ''))

  base.signed = true
  base.validSignature = true
  base.status = 'official'
  base.identity = details.match(/Authority=(.+)/)?.[1] || null
  base.teamIdentifier = details.match(/TeamIdentifier=(.+)/)?.[1] || null
  base.hardenedRuntime = /flags=.*runtime/.test(details)

  return base
}

function shouldBlock(integrity) {
  return integrity?.packaged === true &&
    integrity?.platform === 'darwin' &&
    integrity?.signed === true &&
    integrity?.validSignature === false &&
    integrity?.status === 'modified'
}

module.exports = { inspectIntegrity, shouldBlock }
