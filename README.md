# Liquid WhatsApp

Liquid WhatsApp is an unofficial Electron desktop client for **macOS Catalina and Intel Macs**. It provides a custom WhatsApp-style desktop experience with local message storage, media tools, voice notes, groups, status, polls, calls UI, and a Catalina/Intel-focused build.

Made by **Gerald (Mateo devs)**.

> WhatsApp and the WhatsApp name, logo and related marks are trademarks of Meta Platforms, Inc. Liquid WhatsApp is independent, unofficial software and is not affiliated with or endorsed by Meta.

## Download

### GitHub Releases

All downloadable versions are published through **GitHub Releases**:

**https://github.com/Romeoisl/Whatsapp-UNOFFICIAL-/releases**

Each release has its own version tag, such as `v2.2.2`, so older versions remain available instead of being replaced by a temporary GitHub Actions artifact.

Release assets are built for **Intel x64 Macs**:

- **DMG** — `Liquid-WhatsApp-<version>-Catalina-Intel.dmg`
- **ZIP** — `Liquid-WhatsApp-<version>-x64.zip`

### Current target

- macOS 10.15 Catalina or newer
- Intel x64 Macs
- DMG and ZIP packages
- Minimum macOS version: 10.15
- Apple Silicon is not currently packaged

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
npm run build:catalina
```

This creates a local Intel DMG and ZIP without publishing them.

## Publish a GitHub Release

Update the version in `package.json`, commit it, then create and push a matching semantic version tag:

```bash
git tag v2.2.3
git push origin v2.2.3
```

The GitHub Actions workflow runs for tags matching `v*.*.*`. It:

1. Checks that the Git tag matches `package.json`.
2. Installs dependencies.
3. Runs the project checks.
4. Builds the macOS Intel x64 DMG and ZIP.
5. Publishes both files to the matching GitHub Release.

For example:

```text
GitHub Releases
└── v2.2.3
    ├── Liquid-WhatsApp-2.2.3-Catalina-Intel.dmg
    └── Liquid-WhatsApp-2.2.3-x64.zip
```

GitHub Releases are the **only versioned download system** for the project. There is no separate release website.

You can also publish locally when `GH_TOKEN` is configured:

```bash
npm run release
```

electron-builder uses the GitHub publisher configured in `package.json`.

## Release workflow

The release workflow is located at:

```text
.github/workflows/build-dmg.yml
```

Manual workflow runs build the Intel Catalina DMG/ZIP as GitHub Actions artifacts. Version tags publish the same builds to GitHub Releases.

## Contributing

Issues and pull requests are welcome. Please avoid posting personal WhatsApp session data, authentication credentials, private messages or exported application data in issues or pull requests.

## Credits

Made by **Gerald (Mateo devs)**.

Liquid WhatsApp is unofficial software and is not affiliated with Meta Platforms, Inc.
