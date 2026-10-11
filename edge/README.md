# ChatGPT Conversation to PDF for Edge

This Manifest V3 Edge extension captures the messages currently present in an open ChatGPT conversation and formats them in a print-friendly page. Choose **Save as PDF** in Edge's print dialog to create the PDF. You can also select part of a chat, right-click, and choose **Convert selection to PDF** to export just that selection.

## Load it in Edge for development

1. Open `edge://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this `edge` folder.
4. Open a ChatGPT conversation and click the extension toolbar icon.
5. Review the formatted conversation, click **Save as PDF**, then select **Save as PDF** as the printer/destination. For a selection-only export, highlight chat text and use the right-click context menu.

The extension reads conversation messages from the current ChatGPT tab only when its toolbar button is clicked. It does not send conversation content to a server. ChatGPT can change its page markup, so selectors may need updates if extraction stops working. Messages not currently loaded into the page may not be included.

## Publish

Zip the contents of this folder (so `manifest.json` is at the ZIP root) and submit the package through the Microsoft Edge Add-ons Partner Center. See [Microsoft's publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).
