const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, shell, systemPreferences } = require('electron')
const os = require('os')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')
const WhatsAppCore = require('./backend/core')

app.setName('Liquid WhatsApp')

const DATA_DIR = path.join(app.getPath('userData'), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const core = new WhatsAppCore(DATA_DIR)
let win = null
let backupTimer = null
let updateCheckTimer = null
let updateDownloadStarted = false

function forward(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send('ev:' + channel, data)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 620,
    title: 'Liquid WhatsApp',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f241b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      sandbox: false
    }
  })

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => { win = null })
}

function buildMenu() {
  const template = [
    { label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' }
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' }
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }
    ]}
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function safeHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      const message = e?.message || String(e)
      console.error('[IPC]', message)
      throw new Error(message)
    }
  }
}

async function chooseFile(title, filters) {
  const res = await dialog.showOpenDialog(win, {
    title,
    properties: ['openFile'],
    filters
  })
  return res.canceled || !res.filePaths.length ? null : res.filePaths[0]
}

function registerIpc() {
  ipcMain.handle('app:init', () => ({
    hasSession: core.hasSession(),
    user: core.userInfo(),
    settings: core.getSettings(),
    schedules: core.getSchedules(),
    starred: core.getStarred()
  }))

  ipcMain.handle('core:pair', safeHandler((_e, number) => core.pairWithPhone(number)))
  ipcMain.handle('core:logout', safeHandler(() => core.logout()))
  ipcMain.handle('chat:set-active', (_e, jid) => core.setActiveJid(jid))

  ipcMain.handle('call:action', safeHandler((_e, action, callId, targetJid, isVideo) => core.callAction(action, callId, targetJid, !!isVideo)))

  ipcMain.handle('chat:send-text', safeHandler((_e, jid, text, quoted) => core.sendText(jid, text, quoted)))

  ipcMain.handle('chat:send-image', safeHandler(async (_e, jid, caption, quoted) => {
    const file = await chooseFile('Choose an image', [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'] }
    ])
    if (!file) return { ok: false, reason: 'canceled' }
    await core.sendImage(jid, file, caption || '', quoted)
    return { ok: true }
  }))

  ipcMain.handle('chat:send-dropped-media', safeHandler((_e, jid, filePath, caption, quoted) => core.sendMedia(jid, filePath, caption || '', quoted)))

  ipcMain.handle('chat:send-media', safeHandler(async (_e, jid, caption, quoted) => {
    const file = await chooseFile('Choose a file', [
      { name: 'Media and documents', extensions: [
        'jpg','jpeg','png','gif','webp','heic','mp4','mov','m4v',
        'mp3','m4a','ogg','opus','pdf','doc','docx','xls','xlsx','ppt','pptx','txt','zip'
      ]},
      { name: 'All files', extensions: ['*'] }
    ])
    if (!file) return { ok: false, reason: 'canceled' }
    await core.sendMedia(jid, file, caption || '', quoted)
    return { ok: true }
  }))

  ipcMain.handle('chat:send-voice-note', safeHandler(async (_e, jid, dataUrl, durationMs, quoted) => {
    if (!jid || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:audio/')) throw new Error('Invalid voice note')
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('Invalid voice note data')
    const ext = match[1].includes('ogg') ? '.ogg' : '.webm'
    const dir = path.join(DATA_DIR, 'voice-notes')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `voice-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`)
    fs.writeFileSync(file, Buffer.from(match[2], 'base64'))
    try {
      await core.sendVoiceNote(jid, file, quoted)
      return { ok: true, durationMs: Number(durationMs) || 0 }
    } finally {
      try { fs.unlinkSync(file) } catch (_) {}
    }
  }))

  ipcMain.handle('chat:typing', (_e, jid, on) => core.sendTyping(jid, on))
  ipcMain.handle('chat:load', safeHandler((_e, jid) => core.loadMessages(jid, 80)))
  ipcMain.handle('chat:search', safeHandler((_e, q, jid) => core.searchMessages(q, jid)))
  ipcMain.handle('chat:meta', safeHandler((_e, jid, patch) => core.setChatMeta(jid, patch)))
  ipcMain.handle('chat:archive', safeHandler((_e, jid, value) => core.archiveChat(jid, value)))
  ipcMain.handle('chat:pin', safeHandler((_e, jid, value) => core.pinChat(jid, value)))
  ipcMain.handle('chat:mute', safeHandler((_e, jid, value) => core.muteChat(jid, value)))
  ipcMain.handle('group:action', safeHandler((_e, jid, action, participants) => core.groupAction(jid, action, participants)))
  ipcMain.handle('group:subject', safeHandler((_e, jid, subject) => core.groupUpdateSubject(jid, subject)))
  ipcMain.handle('group:leave', safeHandler((_e, jid) => core.groupLeave(jid)))
  ipcMain.handle('chat:read', safeHandler((_e, jid, ids) => core.readMessages(jid, ids)))
  ipcMain.handle('chat:edit', safeHandler((_e, jid, id, text) => core.editMessage(jid, id, text)))
  ipcMain.handle('chat:delete', safeHandler((_e, jid, id) => core.deleteMessage(jid, id)))
  ipcMain.handle('chat:react', safeHandler((_e, jid, msg, reaction) => core.reactMessage(jid, msg, reaction)))
  ipcMain.handle('chat:forward', safeHandler((_e, msg, targetJid) => core.forwardMessage(msg.jid, msg, targetJid)))
  ipcMain.handle('chat:poll', safeHandler((_e, jid, name, options, pollSettings) => core.sendPoll(jid, name, options, pollSettings)))
  ipcMain.handle('chat:viewonce', safeHandler((_e, jid, text) => core.sendViewOnce(jid, text)))
  ipcMain.handle('chat:broadcast', safeHandler((_e, jids, text) => core.sendBroadcast(jids, text)))
  ipcMain.handle('chat:mention-all', safeHandler((_e, jid, text) => core.sendMentionAll(jid, text)))
  ipcMain.handle('chat:disappear', safeHandler((_e, jid, sec) => core.setDisappearing(jid, sec)))
  ipcMain.handle('chat:sticker', safeHandler(async (_e, jid) => {
    const file = await chooseFile('Choose a WebP sticker', [
      { name: 'WebP stickers', extensions: ['webp'] }
    ])
    if (!file) return { ok: false, reason: 'canceled' }
    await core.sendSticker(jid, file)
    return { ok: true }
  }))

  ipcMain.handle('chat:star', safeHandler((_e, m) => core.toggleStarred(m)))
  ipcMain.handle('chat:starred', () => core.getStarred())
  ipcMain.handle('media:download', safeHandler((_e, dto) => core.downloadMedia(dto)))
  ipcMain.handle('contacts:list', () => core.contactList())
  ipcMain.handle('group:participants', safeHandler((_e, jid) => core.groupParticipants(jid)))

  ipcMain.handle('status:post', safeHandler((_e, text) => core.postStatus(text)))
  ipcMain.handle('status:post-image', safeHandler(async (_e, caption) => {
    const file = await chooseFile('Choose a status image', [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ])
    if (!file) return { ok: false, reason: 'canceled' }
    await core.postStatusImage(file, caption || '')
    return { ok: true }
  }))

  ipcMain.handle('privacy:set', safeHandler((_e, key, value) => core.setPrivacy(key, value)))
  ipcMain.handle('settings:get', () => core.getSettings())
  ipcMain.handle('settings:set', safeHandler((_e, patch) => core.setSettings(patch)))
  ipcMain.handle('diagnostics:get', async () => {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    let storage = null
    try {
      const stat = fs.statfsSync(app.getPath('userData'))
      storage = { free: Number(stat.bavail) * Number(stat.bsize), total: Number(stat.blocks) * Number(stat.bsize) }
    } catch (_) {}

    let gpu = null
    try {
      gpu = { featureStatus: app.getGPUFeatureStatus(), info: await app.getGPUInfo('basic') }
    } catch (_) {}

    const permissions = {}
    for (const type of ['microphone', 'camera']) {
      try { permissions[type] = systemPreferences.getMediaAccessStatus(type) } catch (_) { permissions[type] = 'unknown' }
    }

    const metrics = app.getAppMetrics()
    const cpu = metrics.reduce((sum, item) => sum + (Number(item.cpu?.percentCPUUsage) || 0), 0)
    const privateMemory = metrics.reduce((sum, item) => sum + (Number(item.memory?.private) || 0), 0)

    return {
      app: {
        name: app.getName(), version: app.getVersion(), electron: process.versions.electron,
        chrome: process.versions.chrome, node: process.versions.node, packaged: app.isPackaged,
        platform: process.platform, arch: process.arch
      },
      system: {
        os: process.getSystemVersion(), release: os.release(), cpu: os.cpus()[0]?.model || 'Unknown',
        cores: os.cpus().length, memory: { total: totalMem, free: freeMem, used: Math.max(0, totalMem - freeMem) },
        storage, uptime: os.uptime()
      },
      process: { cpuPercent: cpu, privateMemory, processCount: metrics.length },
      permissions,
      gpu,
      connection: { hasSession: core.hasSession(), connected: core.connection === 'open' },
      performance: { mode: core.getSettings().performanceMode || 'auto' }
    }
  })

  ipcMain.handle('session:info', () => core.getLinkedSession())
  ipcMain.handle('local:info', () => core.localDatabaseInfo())
  ipcMain.handle('local:clear-backups', safeHandler(() => core.clearBackups()))
  ipcMain.handle('calls:history', () => core.getCallHistory())
  ipcMain.handle('calls:clear-history', safeHandler(() => core.clearCallHistory()))
  ipcMain.handle('calls:create-link', safeHandler((_e, type) => core.createCallLink(type)))
  ipcMain.handle('local:export', safeHandler(async () => {
    const res = await dialog.showSaveDialog(win, {
      title: 'Export Liquid WhatsApp data',
      defaultPath: path.join(app.getPath('documents'), `Liquid-WhatsApp-backup-${new Date().toISOString().slice(0,10)}.json`),
      filters: [{ name: 'JSON backup', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, reason: 'canceled' }
    fs.writeFileSync(res.filePath, JSON.stringify(core.exportLocalData(), null, 2), 'utf8')
    return { ok: true, path: res.filePath }
  }))
  ipcMain.handle('autoreply:add', safeHandler((_e, rule) => core.addAutoReply(rule)))
  ipcMain.handle('autoreply:remove', safeHandler((_e, id) => core.removeAutoReply(id)))
  ipcMain.handle('schedule:list', () => core.getSchedules())
  ipcMain.handle('schedule:add', safeHandler((_e, s) => core.addSchedule(s)))
  ipcMain.handle('schedule:remove', safeHandler((_e, id) => core.removeSchedule(id)))

  ipcMain.handle('update:check', safeHandler(() => checkForUpdates(true)))
  ipcMain.handle('update:download', safeHandler(() => downloadUpdate()))
  ipcMain.handle('update:install', safeHandler(() => installUpdate()))

  ipcMain.handle('external:open', safeHandler((_e, url) => {
    if (!/^https?:\/\//i.test(String(url))) throw new Error('Only http(s) links can be opened')
    return shell.openExternal(String(url))
  }))
}

function setupAutoUpdater() {
  if (!app.isPackaged || process.platform !== 'darwin' || process.arch !== 'x64') return

  // Never download an update automatically: the user must approve the data usage.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.autoInstallEvent = 'manual'
  autoUpdater.allowPrerelease = false
  autoUpdater.fullChangelog = false

  // Keep differential downloads enabled. GitHub's release layout can otherwise
  // make the updater look for the previous blockmap under the latest release.
  // Point it at the release matching the currently installed version so the
  // updater can compare the old installer blocks and download only the blocks
  // it needs when a valid blockmap is available.
  autoUpdater.disableDifferentialDownload = false
  autoUpdater.previousBlockmapBaseUrlOverride =
    `https://github.com/Romeoisl/Whatsapp-UNOFFICIAL-/releases/download/v${app.getVersion()}/`

  autoUpdater.on('checking-for-update', () => forward('update:checking', { version: app.getVersion() }))
  autoUpdater.on('update-available', (info) => {
    updateDownloadStarted = false
    forward('update:available', {
      version: info.version,
      releaseName: info.releaseName || info.version,
      releaseNotes: info.releaseNotes || null
    })
  })
  autoUpdater.on('update-not-available', (info) => {
    forward('update:not-available', { version: info?.version || app.getVersion() })
  })
  autoUpdater.on('download-progress', (progress) => {
    forward('update:progress', {
      percent: Number(progress.percent) || 0,
      transferred: Number(progress.transferred) || 0,
      total: Number(progress.total) || 0,
      bytesPerSecond: Number(progress.bytesPerSecond) || 0
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloadStarted = false
    forward('update:downloaded', {
      version: info.version,
      releaseName: info.releaseName || info.version
    })
  })
  autoUpdater.on('update-cancelled', () => {
    updateDownloadStarted = false
    forward('update:cancelled', {})
  })
  autoUpdater.on('error', (error) => {
    updateDownloadStarted = false
    console.warn('[updater]', error?.message || error)
    forward('update:error', { message: error?.message || String(error) })
  })
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged || process.platform !== 'darwin' || process.arch !== 'x64') {
    if (manual) forward('update:error', { message: 'Updates are available only for packaged Intel macOS builds.' })
    return null
  }
  return autoUpdater.checkForUpdates()
}

async function downloadUpdate() {
  if (updateDownloadStarted) return { ok: true, alreadyStarted: true }
  updateDownloadStarted = true
  await autoUpdater.downloadUpdate()
  return { ok: true }
}

function installUpdate() {
  if (!app.isPackaged) throw new Error('Updates are only available in the packaged app')
  autoUpdater.quitAndInstall(false, true)
  return { ok: true }
}

core.on('connection', (u) => forward('connection', u))
core.on('chats', (c) => {
  forward('chats', c)
  if (app.dock) {
    const n = c.reduce((a, x) => a + (x.unread || 0), 0)
    app.dock.setBadge(n ? (n > 99 ? '99+' : String(n)) : '')
  }
})
core.on('messages', (p) => forward('messages', p))
core.on('presence', (p) => forward('presence', p))
core.on('settings', (s) => forward('settings', s))
core.on('schedules', (s) => forward('schedules', s))
core.on('call:incoming', (callData) => forward('call:ring', callData))
core.on('calls', (history) => forward('calls', history))
core.on('call:state', (state) => forward('call:state', state))
core.on('call:error', (error) => forward('call:error', error))
core.on('call:audio', (audio) => forward('call:audio', audio))
core.on('call:video', (video) => forward('call:video', video))

core.on('notify', (items) => {
  if (core.getSettings().notifications === false || !Notification.isSupported()) return
  for (const it of items) {
    const n = new Notification({
      title: it.name || 'Message',
      body: core.getSettings().showPreviews === false ? 'New message' : (it.text || 'New message'),
      silent: !core.getSettings().soundNotifications,
      soundName: 'default'
    })
    n.on('click', () => {
      if (!win || win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      win.webContents.send('ev:open-chat', it.jid)
    })
    n.show()
  }
})

app.whenReady().then(() => {
  buildMenu()
  registerIpc()
  createWindow()
  setupAutoUpdater()
  // Do not create an anonymous WhatsApp socket on the login screen.
  // The pairing flow creates its own socket only after the user submits a number.
  if (core.hasSession()) {
    core.start().catch((e) => console.error('[core] start failed:', e.message))
  }

  // Update checks are intentionally silent when nothing is available.
  // The first check waits until startup settles, then repeats every 6 hours.
  if (app.isPackaged && process.platform === 'darwin' && process.arch === 'x64') {
    setTimeout(() => checkForUpdates(false).catch((e) => console.warn('[updater]', e.message)), 10000)
    updateCheckTimer = setInterval(() => {
      checkForUpdates(false).catch((e) => console.warn('[updater]', e.message))
    }, 6 * 60 * 60 * 1000)
  }
  // Backups are intentionally lazy. The old implementation serialized the
  // entire local message database synchronously 5 seconds after startup,
  // which could freeze an older Intel Mac.
  backupTimer = setInterval(async () => {
    const settings = core.getSettings()
    if (settings.backupEnabled === false) return
    try {
      const dir = path.join(DATA_DIR, 'backups')
      await fs.promises.mkdir(dir, { recursive: true })
      const file = path.join(dir, 'latest.json')
      const intervalMs = Math.max(1, Number(settings.backupIntervalHours) || 24) * 60 * 60 * 1000
      const stale = !fs.existsSync(file) || (Date.now() - fs.statSync(file).mtimeMs > intervalMs)
      if (stale) {
        const payload = JSON.stringify(core.exportLocalData())
        await fs.promises.writeFile(file, payload, 'utf8')
      }
    } catch (e) { console.warn('[backup]', e.message) }
  }, 60 * 60 * 1000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  if (backupTimer) clearInterval(backupTimer)
  if (updateCheckTimer) clearInterval(updateCheckTimer)
  try { core.dispose() } catch (_) {}
})
