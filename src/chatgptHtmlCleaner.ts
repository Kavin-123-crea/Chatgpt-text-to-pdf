import { load } from 'cheerio';

export function prepareChatGPTHtml(clipboardHtml: string): string {
    const $ = load(clipboardHtml);

    /*
     * Remove ChatGPT UI elements that should NOT appear in the PDF.
     */
    $(
        [
            'button',
            '[role="button"]',
            '[data-testid*="action"]',
            '[data-testid*="toolbar"]',
            '[data-testid*="copy"]',
            '[data-testid*="feedback"]',
            '[data-testid*="regenerate"]',
            '[data-testid*="share"]',
            '[data-testid*="attachment"]',
            'script',
            'style',
            'svg'
        ].join(',')
    ).remove();

    /*
     * Locate the actual ChatGPT messages.
     *
     * User:
     *   [data-user-message-bubble="true"]
     *
     * Assistant:
     *   [data-markdown-text-style="assistant-message"]
     */
    const messages = $(
        '[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]'
    ).toArray();

    if (messages.length === 0) {
        throw new Error(
            'No ChatGPT messages were found in the HTML clipboard data.'
        );
    }

    /*
     * Build a clean HTML document containing only the conversation.
     */
    const messageHtml = messages
        .map((message) => {
            const element = $(message);

            const isUser = element.is(
                '[data-user-message-bubble="true"]'
            );

            const role = isUser ? 'user' : 'assistant';

            return `
                <section class="chat-message ${role}">
                    ${element.toString()}
                </section>
            `;
        })
        .join('\n');

    /*
     * The clipboard HTML may contain references to ChatGPT's
     * original stylesheet/classes. We cannot depend on those styles
     * existing once the HTML is rendered outside ChatGPT.
     *
     * Therefore we provide a small local stylesheet that recreates
     * the important visual appearance.
     */
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<style>

    * {
        box-sizing: border-box;
    }

    html,
    body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #1f2937;
        font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Helvetica,
            Arial,
            sans-serif;
    }

    body {
        padding: 32px 0;
    }

    .conversation {
        width: 100%;
        max-width: 850px;
        margin: 0 auto;
        padding: 0 28px;
    }

    .chat-message {
        width: 100%;
        margin-bottom: 28px;
    }

    /*
     * USER MESSAGE
     */

    .chat-message.user {
        display: flex;
        justify-content: flex-end;
    }

    .chat-message.user > * {
        max-width: 70%;
    }

    .chat-message.user > div {
        background: rgb(232, 243, 254);
        color: rgb(12, 39, 74);
        padding: 10px 16px;
        border-radius: 22px;
    }

    /*
     * ASSISTANT MESSAGE
     */

    .chat-message.assistant {
        display: block;
    }

    .chat-message.assistant > div {
        width: 100%;
    }

    /*
     * TEXT
     */

    p {
        margin: 0 0 14px 0;
        line-height: 1.65;
    }

    p:last-child {
        margin-bottom: 0;
    }

    strong {
        font-weight: 700;
    }

    em {
        font-style: italic;
    }

    /*
     * HEADINGS
     */

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
        margin-top: 24px;
        margin-bottom: 12px;
        line-height: 1.3;
    }

    h1 {
        font-size: 28px;
    }

    h2 {
        font-size: 24px;
    }

    h3 {
        font-size: 21px;
    }

    h4 {
        font-size: 18px;
    }

    /*
     * INLINE CODE
     */

    code {
        font-family:
            "Cascadia Mono",
            "Consolas",
            "Courier New",
            monospace;
        font-size: 0.9em;
    }

    :not(pre) > code {
        background: #f1f1f1;
        padding: 2px 5px;
        border-radius: 5px;
    }

    /*
     * CODE BLOCKS
     */

    pre {
        background: #f6f6f6;
        border-radius: 10px;
        padding: 16px;
        overflow-x: auto;
        margin: 16px 0;
        white-space: pre-wrap;
        word-break: break-word;
    }

    pre code {
        font-size: 13px;
        line-height: 1.5;
    }

    /*
     * BLOCKQUOTES
     */

    blockquote {
        margin: 16px 0;
        padding: 8px 16px;
        border-left: 4px solid #d1d5db;
        color: #4b5563;
    }

    /*
     * LISTS
     */

    ul,
    ol {
        margin-top: 8px;
        margin-bottom: 16px;
        padding-left: 28px;
    }

    li {
        margin-bottom: 6px;
        line-height: 1.55;
    }

    /*
     * TABLES
     */

    table {
        width: 100%;
        border-collapse: collapse;
        margin: 18px 0;
        font-size: 14px;
    }

    th,
    td {
        border: 1px solid #d1d5db;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
    }

    th {
        background: #f3f4f6;
        font-weight: 700;
    }

    /*
     * HORIZONTAL RULE
     */

    hr {
        border: 0;
        border-top: 1px solid #e5e7eb;
        margin: 24px 0;
    }

    /*
     * IMAGES
     */

    img {
        max-width: 100%;
        height: auto;
    }

    /*
     * LINKS
     */

    a {
        color: #2563eb;
        text-decoration: underline;
    }

    /*
     * SELECTION / UI ARTIFACTS
     */

    [data-selected-text-overlay-target],
    [data-chatgpt-selection-conversation-id],
    [data-chatgpt-selection-message-id] {
        position: static !important;
    }

</style>
</head>

<body>

<main class="conversation">
    ${messageHtml}
</main>

</body>
</html>
`;
}