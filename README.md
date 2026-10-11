# Selected Text to PDF

A VS Code extension that converts the currently selected editor text into a PDF.

## Features

- Right-click selected text → **Convert Selected Text to PDF**
- Command Palette support
- Choose PDF title and save location
- Preserves line breaks and whitespace
- Basic Markdown heading and list formatting
- Optional page numbers
- Fully local; no API key or server required

## Run in VS Code

1. Open this folder in VS Code.
2. Open the integrated terminal.
3. Run:

```bash
npm install
npm run compile
```

4. Press `F5` to launch an Extension Development Host.
5. Open a text file, select text, right-click, and choose **Convert Selected Text to PDF**.

## Package as a VSIX

Install the VS Code Extension Manager once if needed:

```bash
npm install
npm run package
```

This creates a `.vsix` file in the project folder.

Install it from VS Code with **Extensions → ... → Install from VSIX...**.
