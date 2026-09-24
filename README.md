# Liquid WhatsApp

Liquid WhatsApp is an unofficial Electron desktop client for **macOS Catalina and Intel Macs**. It provides a custom WhatsApp-style desktop experience with local message storage, media tools, voice notes, groups, status, polls, calls UI, and a Catalina/Intel-focused build.

Made by **Gerald (Mateo devs)**.

> WhatsApp and the WhatsApp name, logo and related marks are trademarks of Meta Platforms, Inc. Liquid WhatsApp is independent, unofficial software and is not affiliated with or endorsed by Meta.

## Download

### Versioned releases

Use the dedicated release page to browse every published version and download its DMG or ZIP:

**https://romeoisl.github.io/Whatsapp-UNOFFICIAL-/release/**

You can also use the GitHub Releases page:

**https://github.com/Romeoisl/Whatsapp-UNOFFICIAL-/releases**

Each release is tied to a version tag such as `v2.2.2`, so older versions remain available instead of being replaced by a single temporary Actions artifact.

### Current target

- macOS 10.15 Catalina or newer
- Intel x64 Macs
- DMG and ZIP packages
- Minimum macOS version: 10.15

## Features

- Native macOS notifications with preview/sound controls
- Persistent append-only local message database with legacy migration
- Offline text outbox with automatic retry after reconnection
- Automatic local backup plus manual JSON export
- Chat search and in-chat message search
- Contact/profile and group-management views
- Media gallery and drag-and-drop attachments
- Pin, mute, archive and starred messages
- System/light/dark/Liquid Glass-inspired themes
- macOS keyboard shortcuts
- Dock unread badge and notification click-to-open-chat
- Reconnection and session recovery
- Settings & Preferences navigation
- Storage management
- Status posting
- Polls with multiple-answer support
- Group controls and `@all` mentions
- Call history and call links
- Voice notes through the bundled FFmpeg pipeline
- Catalina/Intel-focused performance optimizations
- VoIP/WASM calling layer integration for one-to-one calls

## v2.2 Liquid Glass

The UI uses a Liquid Glass-inspired visual layer with translucent panels, adaptive blur/saturation, soft highlights, floating controls and reduced-motion/performance modes.

Because Catalina predates Apple's native Liquid Glass APIs, the effect is implemented with Electron/CSS.

## Voice notes

Electron recordings are normalized with the bundled `ffmpeg-static` binary before upload. Browser WebM/Opus recordings are converted to OGG/Opus for WhatsApp push-to-talk audio.

## Calling

The current codebase includes a WhatsApp VoIP/WASM calling layer and one-to-one call UI/signaling integration.

**Important:** real-world voice/video calling still needs end-to-end testing on the target Catalina Intel Mac and with a second WhatsApp account. Group calling is intentionally not part of the current implementation.

## Security and account risk

Liquid WhatsApp uses an unofficial WhatsApp protocol implementation. WhatsApp can change its protocol, and use of unofficial clients may result in account restrictions. Test with an account you are prepared to lose.

Session credentials and local message data are stored locally by the application. Treat the Mac user account and application data directory as sensitive. Do not share your Liquid WhatsApp data directory publicly.

## Install from source

```bash
npm install
npm run check
npm start
```

## Build for Intel Catalina

```bash
npm run dist
```

This creates a local DMG and ZIP without publishing them.

## Publish a release

Set the version in `package.json`, commit it, then create and push a matching tag:

```bash
git tag v2.2.3
git push origin v2.2.3
```

The GitHub Actions release workflow verifies that the tag matches `package.json`, builds the Catalina Intel DMG/ZIP, and publishes them to a GitHub Release.

You can also publish locally when `GH_TOKEN` is configured:

```bash
npm run release
```

electron-builder uses the GitHub publisher configured in `package.json`.

## Release URLs

- Release browser: https://github.com/Romeoisl/Whatsapp-UNOFFICIAL-/releases
- Versioned download page: https://romeoisl.github.io/Whatsapp-UNOFFICIAL-/release/
- A specific version can be selected on the release page with `?version=2.2.2`.

## Contributing

Issues and pull requests are welcome. Please avoid posting personal WhatsApp session data, authentication credentials, private messages or exported application data in issues or pull requests.

## Credits

Made by **Gerald (Mateo devs)**.

Liquid WhatsApp is unofficial software and is not affiliated with Meta Platforms, Inc.
