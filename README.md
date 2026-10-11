# Selected Text and ChatGPT to PDF

This repository contains two related tools:

- A VS Code extension that exports selected editor text or copied ChatGPT content to PDF.
- An Edge extension in [`edge/`](./edge/) that captures the current ChatGPT conversation and formats it for saving through Edge's print dialog.

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

## Edge extension

See [`edge/README.md`](./edge/README.md) for local installation, testing, and publishing instructions. In brief, open `edge://extensions`, enable Developer mode, and choose **Load unpacked** to select the `edge` folder.

## Privacy

The extensions process content locally. The Edge extension reads the current ChatGPT page only when its toolbar button is clicked; it does not send conversation content to a server.

## License

MIT. See [`LICENSE`](./LICENSE).
