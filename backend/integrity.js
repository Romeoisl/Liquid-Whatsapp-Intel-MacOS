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

function outputText(result) {
  return typeof result === 'string'
    ? result
    : ((result?.stderr || '') + (result?.stdout || '')).toString()
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
    developerIdSigned: false,
    gatekeeperAccepted: false,
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

  if (verify?.error) {
    const message = outputText(verify).trim()
    const display = run('/usr/bin/codesign', ['-dv', '--verbose=4', bundlePath])
    const details = outputText(display)

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
    base.hardenedRuntime = /flags=.*runtime/.test(details)
    return base
  }

  const display = run('/usr/bin/codesign', ['-dv', '--verbose=4', bundlePath])
  const details = outputText(display)
  const identity = details.match(/Authority=(.+)/)?.[1] || null
  const teamIdentifier = details.match(/TeamIdentifier=(.+)/)?.[1] || null
  const developerIdSigned = /Authority=Developer ID Application:/m.test(details)
  const hardenedRuntime = /flags=.*runtime/.test(details)

  const gatekeeper = run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', bundlePath])
  const gatekeeperAccepted = !gatekeeper?.error

  base.signed = true
  base.validSignature = true
  base.developerIdSigned = developerIdSigned
  base.gatekeeperAccepted = gatekeeperAccepted
  base.identity = identity
  base.teamIdentifier = teamIdentifier
  base.hardenedRuntime = hardenedRuntime

  if (developerIdSigned && hardenedRuntime && gatekeeperAccepted) {
    base.status = 'official'
    base.reason = null
  } else {
    base.status = 'signed-unverified'
    const missing = []
    if (!developerIdSigned) missing.push('Developer ID Application signature')
    if (!hardenedRuntime) missing.push('Hardened Runtime')
    if (!gatekeeperAccepted) missing.push('Gatekeeper acceptance')
    base.reason = `Signature is valid, but this build is not fully verified: ${missing.join(', ')}.`
  }

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
