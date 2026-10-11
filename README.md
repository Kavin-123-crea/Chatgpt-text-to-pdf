# Selected Text and ChatGPT to PDF

This repository contains a VS Code extension that exports selected editor text or copied ChatGPT content to PDF.

## VS Code extension

### Requirements

- Visual Studio Code 1.85 or later
- Node.js and npm to build or package from source

### Build and run

```bash
npm install
npm run compile
```

Open this folder in VS Code, press `F5` to launch an Extension Development Host, then select text and run **Convert Selected Text to PDF** from the editor context menu or Command Palette.

To package a VSIX:

```bash
npm run package
```

## Privacy

The extension processes content locally; it does not send conversation content to a server.

## License

MIT. See [`LICENSE`](./LICENSE).
