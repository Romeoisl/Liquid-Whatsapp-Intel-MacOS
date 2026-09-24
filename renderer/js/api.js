const api = {
  subscribed: false,
  handlers: { 
    connection: [], chats: [], messages: [], 
    presence: [], settings: [], schedules: [], calls: [],
    call: [], 'call-state': [], 'call-error': [], 'call-audio': [], 'call-video': [], outbox: []
  },

  async init() {
    const boot = await window.liquid.init()
    Store.user = boot.user
    Store.settings = boot.settings || {}
    Store.schedules = boot.schedules || []
    return boot
  },

  on(channel, cb) {
    if (!this.handlers[channel]) this.handlers[channel] = []
    this.handlers[channel].push(cb)
  },

  _emit(channel, data) {
    for (const cb of this.handlers[channel] || []) cb(data)
  },

  subscribe() {
    if (this.subscribed) return
    this.subscribed = true
    window.liquid.on('connection', (u) => {
      Store.conn = u.connection
      if (u.loggedOut) Store.reset()
      this._emit('connection', u)
    })
    window.liquid.on('chats', (list) => { Store.setChats(list); this._emit('chats', list) })
    window.liquid.on('messages', ({ jid, messages, statusUpdates }) => {
      if (statusUpdates) {
        Store.applyStatusUpdates(jid, statusUpdates)
        this._emit('messages', { jid, messages: [], statusUpdates })
      } else {
        Store.upsertMessages(jid, messages)
        this._emit('messages', { jid, messages })
      }
    })
    window.liquid.on('presence', ({ jid, state }) => {
      if (jid) Store.presence.set(jid, state)
      this._emit('presence', { jid, state })
    })
    window.liquid.on('settings', (s) => { Store.settings = s; this._emit('settings', s) })
    window.liquid.on('schedules', (s) => { Store.schedules = s; this._emit('schedules', s) })
    window.liquid.on('calls', (history) => this._emit('calls', history))
    window.liquid.onOpenChat((jid) => this._emit('open-chat', jid))

    // Securely listen for secure inbound call network rings passing through the bridge wrapper
    window.liquid.onOutbox((data) => this._emit('outbox', data))
    window.liquid.onCallState((state) => this._emit('call-state', state))
    window.liquid.onCallError((error) => this._emit('call-error', error))
    window.liquid.onCallAudio((audio) => this._emit('call-audio', audio))
    window.liquid.onCallVideo((video) => this._emit('call-video', video))
    window.liquid.onCallRing((callData) => {
      console.log(`[API Interface] Intercepted active ring handshake protocol request token: ${callData.id}`)
      this._emit('call', callData)
    })
  },
}
window.api = api
