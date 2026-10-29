# Selected Text and ChatGPT to PDF

This repository contains a VS Code extension and Chromium browser extensions that export selected text or ChatGPT conversations to PDF.

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

## Microsoft Edge extension

The [`edge/`](./edge/) folder contains a separate unpacked Edge extension for exporting ChatGPT conversations as PDFs. It supports exporting the open conversation from the extension toolbar and exporting selected chat text from the page's right-click menu.

### Install for local use

1. Open `edge://extensions` in Microsoft Edge.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this repository's `edge` folder.
4. Open a conversation on [chatgpt.com](https://chatgpt.com/), then click the extension icon to export the full conversation.
5. To export only part of a message, select the text, right-click, and choose **Convert selection to PDF**.
6. In the print page, click **Save as PDF** and choose Edge's **Save as PDF** destination.

The extension reads the current ChatGPT page locally and does not send conversation content to a server. ChatGPT may leave older messages unloaded in very long conversations, so those messages might not appear in an export.

## Chrome and Brave extensions

The [`chrome/`](./chrome/) and [`brave/`](./brave/) folders contain Chromium-compatible builds of the same extension. They use the same service worker and support both full ChatGPT conversation export and selected-text export.

### Install for local use

1. Open `chrome://extensions` in Google Chrome or `brave://extensions` in Brave.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose the matching `chrome` or `brave` folder from this repository.
5. Open [chatgpt.com](https://chatgpt.com/) and use the extension toolbar button or the **Convert selection to PDF** right-click action.

To regenerate both browser folders from the verified Edge build, run:

```bash
node build-chromium-extensions.js
```

The browser builds are unpacked extensions for local installation. Chrome Web Store and Brave Web Store publication require separate developer accounts and store submissions.

## Privacy

Both extensions process content locally; they do not send conversation content to a server.

## License

MIT. See [`LICENSE`](./LICENSE).
