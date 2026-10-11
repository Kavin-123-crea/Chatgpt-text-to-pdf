<<<<<<< HEAD
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
=======
# Chatgpt-text-to-pdf
VS Code extension that exports selected text or ChatGPT content to a PDF.

Prerequisites to mention in the README

Visual Studio Code 1.85 or later
Node.js and npm if someone wants to build or package the extension from source
ChatGPT in a browser for the ChatGPT clipboard export feature; users copy the conversation content and run the relevant command in VS Code
TypeScript is installed through the project’s npm dependencies, so it doesn’t need a separate setup step

A simple setup section could say:

git clone https://github.com/sreekavinraj/selected-text-to-pdf.git
cd selected-text-to-pdf
npm install
npm run compile
>>>>>>> 72bc9ea40ff29b4edc9632935a1d76368668d360
