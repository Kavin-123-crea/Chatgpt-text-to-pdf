import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { containsMojibake, createChatGPTHtmlPdf, repairKnownMojibake } from './chatgptHtmlPdf';

const execFileAsync = promisify(execFile);

function showCorruptedClipboardMessage(): void {
    vscode.window.showErrorMessage(
        'Clipboard HTML looks corrupted. This usually means the text was decoded with the wrong encoding. Copy directly from the original source and try again.'
    );
}

export function activate(
    context: vscode.ExtensionContext
) {

    console.log(
        'Selected Text to PDF extension activated'
    );

    // ==========================================
    // CLIPBOARD TEST COMMAND
    // ==========================================

    const clipboardTest =
        vscode.commands.registerCommand(
            'selectedTextToPdf.testClipboard',
            async () => {

                const text =
                    await vscode.env.clipboard.readText();

                if (!text.trim()) {

                    vscode.window.showWarningMessage(
                        'Clipboard is empty.'
                    );

                    return;
                }

                const preview =
                    text.length > 1000
                        ? text.substring(0, 1000) +
                          '\n\n...[truncated]'
                        : text;

                const document =
                    await vscode.workspace.openTextDocument({
                        content: preview,
                        language: 'text'
                    });

                await vscode.window.showTextDocument(
                    document
                );

                vscode.window.showInformationMessage(
                    `Clipboard captured: ${text.length} characters`
                );
            }
        );

    context.subscriptions.push(
        clipboardTest
    );


    // ==========================================
    // WINDOWS HTML CLIPBOARD TEST COMMAND
    // ==========================================

    const clipboardHtmlTest =
        vscode.commands.registerCommand(
            'selectedTextToPdf.testClipboardHtml',
            async () => {

                if (process.platform !== 'win32') {
                    vscode.window.showErrorMessage(
                        'The HTML clipboard reader currently supports Windows only.'
                    );
                    return;
                }

                try {
                    await vscode.window.withProgress(
                        {
                            location: vscode.ProgressLocation.Notification,
                            title: 'Reading HTML clipboard...',
                            cancellable: false
                        },
                        async () => {

                            const scriptPath = path.join(
                                context.extensionPath,
                                'scripts',
                                'read-clipboard-html.ps1'
                            );

                            if (!fs.existsSync(scriptPath)) {
                                throw new Error(
                                    `Clipboard script not found: ${scriptPath}`
                                );
                            }

                            const { stdout, stderr } =
                                await execFileAsync(
                                    'powershell.exe',
                                    [
                                        '-NoProfile',
                                        '-STA',
                                        '-ExecutionPolicy',
                                        'Bypass',
                                        '-File',
                                        scriptPath
                                    ],
                                    {
                                        windowsHide: true,
                                        maxBuffer: 20 * 1024 * 1024,
                                        cwd: context.extensionPath
                                    }
                                );

                            if (stderr?.trim()) {
                                console.warn(
                                    'Clipboard PowerShell stderr:',
                                    stderr
                                );
                            }

                            const htmlPath = path.join(
                                context.extensionPath,
                                'clipboard.html'
                            );

                            if (!fs.existsSync(htmlPath)) {
                                throw new Error(
                                    `clipboard.html was not created.\n${stdout}`
                                );
                            }

                            const html = fs.readFileSync(
                                htmlPath,
                                'utf8'
                            );

                            if (
                                !html.trim() ||
                                html.includes('NO_HTML_FORMAT')
                            ) {
                                throw new Error(
                                    'No HTML clipboard content was found. ' +
                                    'Copy the ChatGPT conversation with Ctrl+A → Ctrl+C first.'
                                );
                            }

                            const document =
                                await vscode.workspace.openTextDocument(
                                    vscode.Uri.file(htmlPath)
                                );

                            await vscode.window.showTextDocument(
                                document,
                                { preview: false }
                            );

                            vscode.window.showInformationMessage(
                                `HTML clipboard captured: ${html.length.toLocaleString()} characters`
                            );
                        }
                    );
                } catch (error) {

                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    vscode.window.showErrorMessage(
                        `Could not read HTML clipboard: ${message}`
                    );
                }
            }
        );

    context.subscriptions.push(
        clipboardHtmlTest
    );


    // ==========================================
    // CHATGPT HTML -> PDF COMMAND
    // ==========================================

    const chatgptHtmlExport =
        vscode.commands.registerCommand(
            'selectedTextToPdf.exportChatGPTHtml',
            async () => {

                if (process.platform !== 'win32') {
                    vscode.window.showErrorMessage(
                        'ChatGPT HTML export currently supports Windows only.'
                    );
                    return;
                }

                try {
                    // Reuse the proven clipboard HTML capture command.
                    await vscode.commands.executeCommand(
                        'selectedTextToPdf.testClipboardHtml'
                    );

                    const htmlPath = path.join(
                        context.extensionPath,
                        'clipboard.html'
                    );

                    if (!fs.existsSync(htmlPath)) {
                        throw new Error(
                            'clipboard.html was not created. Copy the ChatGPT conversation with Ctrl+A → Ctrl+C first.'
                        );
                    }

                    const rawHtml = fs.readFileSync(
                        htmlPath,
                        'utf8'
                    );
                    const html = repairKnownMojibake(rawHtml);

                    if (html !== rawHtml) {
                        fs.writeFileSync(htmlPath, html, 'utf8');
                    }

                    if (!html.trim() || html.includes('NO_HTML_FORMAT')) {
                        throw new Error(
                            'No HTML clipboard content was found. Copy the ChatGPT conversation with Ctrl+A → Ctrl+C first.'
                        );
                    }

                    if (containsMojibake(html)) {
                        showCorruptedClipboardMessage();
                        throw new Error(
                            'The copied HTML appears to be corrupted (mojibake/encoding issue). Re-copy the content directly from the browser and try again.'
                        );
                    }

                    const config =
                        vscode.workspace.getConfiguration(
                            'selectedTextToPdf'
                        );

                    const defaultTitle =
                        config.get<string>(
                            'defaultTitle',
                            'ChatGPT Conversation'
                        );

                    const includePageNumbers =
                        config.get<boolean>(
                            'includePageNumbers',
                            true
                        );

                    const titleInput =
                        await vscode.window.showInputBox({
                            prompt: 'Enter a title for the ChatGPT PDF',
                            value: defaultTitle,
                            placeHolder: 'ChatGPT Conversation'
                        });

                    if (titleInput === undefined) {
                        return;
                    }

                    const title =
                        titleInput.trim() || defaultTitle;

                    const defaultFileName =
                        `${sanitizeFileName(title)}.pdf`;

                    const workspacePath =
                        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

                    const defaultUri =
                        workspacePath
                            ? vscode.Uri.file(
                                path.join(
                                    workspacePath,
                                    defaultFileName
                                )
                            )
                            : undefined;

                    const saveUri =
                        await vscode.window.showSaveDialog({
                            title: 'Save ChatGPT PDF',
                            saveLabel: 'Create PDF',
                            filters: {
                                PDF: ['pdf']
                            },
                            defaultUri
                        });

                    if (!saveUri) {
                        return;
                    }

                    await vscode.window.withProgress(
                        {
                            location:
                                vscode.ProgressLocation.Notification,
                            title: 'Creating ChatGPT PDF...',
                            cancellable: false
                        },
                        async () => {
                            await createChatGPTHtmlPdf(
                                html,
                                {
                                    outputPath: saveUri.fsPath,
                                }
                            );
                        }
                    );

                    const action =
                        await vscode.window.showInformationMessage(
                            `ChatGPT PDF created: ${path.basename(saveUri.fsPath)}`,
                            'Open PDF'
                        );

                    if (action === 'Open PDF') {
                        await vscode.env.openExternal(saveUri);
                    }

                } catch (error) {

                    const message =
                        error instanceof Error
                            ? error.message
                            : String(error);

                    vscode.window.showErrorMessage(
                        `Could not create ChatGPT PDF: ${message}`
                    );
                }
            }
        );

    context.subscriptions.push(
        chatgptHtmlExport
    );


    // ==========================================
    // MAIN EXPORT COMMAND
    // ==========================================

    const pdfAlias = vscode.commands.registerCommand(
        'selectedTextToPdf.pdf',
        async () => {
            await vscode.commands.executeCommand('selectedTextToPdf.export');
        }
    );

    context.subscriptions.push(pdfAlias);

    const disposable = vscode.commands.registerCommand(
        'selectedTextToPdf.export',
        async () => {

            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showWarningMessage(
                    'Open a text editor and select some text first.'
                );
                return;
            }

            const selection = editor.selection;

            if (selection.isEmpty) {
                vscode.window.showWarningMessage(
                    'Select the text you want to convert to PDF.'
                );
                return;
            }

            const text = editor.document.getText(selection);

            if (!text.trim()) {
                vscode.window.showWarningMessage(
                    'The selected text is empty.'
                );
                return;
            }

            const config = vscode.workspace.getConfiguration(
                'selectedTextToPdf'
            );

            const defaultTitle = config.get<string>(
                'defaultTitle',
                'Selected Text'
            );

            const includePageNumbers = config.get<boolean>(
                'includePageNumbers',
                true
            );

            const titleInput = await vscode.window.showInputBox({
                prompt: 'Enter a title for the PDF',
                value: defaultTitle,
                placeHolder: 'Selected Text'
            });

            if (titleInput === undefined) {
                return;
            }

            const title = titleInput.trim() || defaultTitle;

            const defaultFileName =
                `${sanitizeFileName(title)}.pdf`;

            const workspacePath =
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

            const defaultUri = workspacePath
                ? vscode.Uri.file(
                    path.join(workspacePath, defaultFileName)
                )
                : undefined;

            const saveUri = await vscode.window.showSaveDialog({
                title: 'Save PDF',
                saveLabel: 'Create PDF',
                filters: {
                    PDF: ['pdf']
                },
                defaultUri
            });

            if (!saveUri) {
                return;
            }

            try {

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Creating PDF...',
                        cancellable: false
                    },
                    async () => {
                        await createPdf(
                            saveUri.fsPath,
                            title,
                            text,
                            includePageNumbers
                        );
                    }
                );

                const action =
                    await vscode.window.showInformationMessage(
                        `PDF created successfully: ${path.basename(saveUri.fsPath)}`,
                        'Open PDF'
                    );

                if (action === 'Open PDF') {
                    await vscode.env.openExternal(saveUri);
                }

            } catch (error) {

                const message =
                    error instanceof Error
                        ? error.message
                        : String(error);

                vscode.window.showErrorMessage(
                    `Could not create PDF: ${message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}


function sanitizeFileName(name: string): string {

    const cleaned = name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned.slice(0, 100) || 'Selected Text';
}


async function createPdf(
    outputPath: string,
    title: string,
    content: string,
    includePageNumbers: boolean
): Promise<void> {

    /*
     * IMPORTANT:
     * PDFKit is loaded only when the command is used.
     * This prevents PDFKit from slowing/failing extension activation.
     */
    const PDFKitModule = await import('pdfkit');

    const PDFDocument =
        PDFKitModule.default;

    return new Promise((resolve, reject) => {

        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 50,
                bottom: 80,
                left: 50,
                right: 50
            },
            bufferPages: true,
            info: {
                Title: title,
                Creator: 'Selected Text to PDF - VS Code Extension'
            }
        });

        const stream =
            fs.createWriteStream(outputPath);

        let finished = false;

        stream.on('error', (error) => {

            if (!finished) {
                finished = true;
                reject(error);
            }

        });

        stream.on('finish', () => {

            if (!finished) {
                finished = true;
                resolve();
            }

        });

        doc.pipe(stream);


        // ==============================
        // TITLE
        // ==============================

        doc
            .font('Helvetica-Bold')
            .fontSize(20)
            .fillColor('#222222')
            .text(title);

        doc.moveDown(0.35);

        doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor('#777777')
            .text('Generated from selected text');

        doc.moveDown(0.5);

        doc
            .strokeColor('#BBBBBB')
            .lineWidth(0.8)
            .moveTo(50, doc.y)
            .lineTo(doc.page.width - 50, doc.y)
            .stroke();

        doc.moveDown(0.7);


        // ==============================
        // BODY
        // ==============================

        const normalized =
            content
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n');

        const lines =
            normalized.split('\n');

        doc
            .font('Helvetica')
            .fontSize(10.5)
            .fillColor('#222222');


        // ==============================
        // CONVERSATION-AWARE RENDER
        // ==============================

        let currentSpeaker: 'USER' | 'CHATGPT' | null = null;

        let conversationBuffer: string[] = [];

        function flushConversation(): void {

            if (conversationBuffer.length === 0) {
                return;
            }

            const message =
                conversationBuffer.join('\n').trim();

            if (!message) {
                conversationBuffer = [];
                return;
            }

            if (currentSpeaker === 'USER') {

                renderSpeakerHeader(
                    doc,
                    'USER'
                );

                renderMessageBody(
                    doc,
                    message
                );

            } else if (currentSpeaker === 'CHATGPT') {

                renderSpeakerHeader(
                    doc,
                    'CHATGPT'
                );

                renderMessageBody(
                    doc,
                    message
                );

            } else {

                renderMessageBody(
                    doc,
                    message
                );
            }

            conversationBuffer = [];
        }


        for (const line of lines) {

            const trimmed = line.trim();

            // Detect USER
            if (/^(USER|YOU)$/i.test(trimmed)) {

                flushConversation();

                currentSpeaker = 'USER';

                continue;
            }


            // Detect CHATGPT / ASSISTANT
            if (
                /^(CHATGPT|ASSISTANT)$/i.test(trimmed)
            ) {

                flushConversation();

                currentSpeaker = 'CHATGPT';

                continue;
            }


            conversationBuffer.push(line);
        }


        flushConversation();


        // ==============================
        // PAGE NUMBERS
        // ==============================

        if (includePageNumbers) {

            addPageNumbers(doc);
        }


        doc.end();
    });
}


function renderSpeakerHeader(
    doc: any,
    speaker: 'USER' | 'CHATGPT'
): void {

    // Space before each new conversation message
    doc.moveDown(0.9);

    const isUser = speaker === 'USER';

    // Speaker label
    doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(isUser ? '#333333' : '#333333')
        .text(speaker);

    doc.moveDown(0.25);

    // Divider
    doc
        .strokeColor('#C8C8C8')
        .lineWidth(0.7)
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .stroke();

    doc.moveDown(0.45);

    // Reset body style
    doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#222222');
}


function renderMessageBody(
    doc: any,
    message: string
): void {

    const lines =
        message
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('\n');


    let insideCodeBlock = false;


    for (const line of lines) {

        const trimmed = line.trim();


        // ============================
        // CODE BLOCK
        // ============================

        if (trimmed.startsWith('```')) {

            insideCodeBlock =
                !insideCodeBlock;

            if (insideCodeBlock) {

                doc.moveDown(0.3);

                doc
                    .font('Courier')
                    .fontSize(9)
                    .fillColor('#333333');

            } else {

                doc.moveDown(0.4);

                doc
                    .font('Helvetica')
                    .fontSize(10.5)
                    .fillColor('#222222');
            }

            continue;
        }


        if (insideCodeBlock) {

            renderCodeLine(doc, line);

            continue;
        }


        // ============================
        // EMPTY LINE
        // ============================

        if (trimmed === '') {

            doc.moveDown(0.4);

            continue;
        }


        // ============================
        // HEADING
        // ============================

        const headingMatch =
            /^(#{1,6})\s+(.+)$/.exec(
                trimmed
            );

        if (headingMatch) {

            const level =
                headingMatch[1].length;

            const size =
                Math.max(
                    12,
                    18 - level
                );

            doc.moveDown(0.4);

            doc
                .font('Helvetica-Bold')
                .fontSize(size)
                .fillColor('#222222')
                .text(
                    headingMatch[2]
                );

            doc.moveDown(0.2);

            continue;
        }


        // ============================
        // BULLET LIST
        // ============================

        const bulletMatch =
            /^\s*[-*•]\s+(.+)$/.exec(
                line
            );

        if (bulletMatch) {

            doc
                .font('Helvetica')
                .fontSize(10.5)
                .fillColor('#222222')
                .text(
                    `• ${bulletMatch[1]}`,
                    {
                        indent: 18,
                        width: doc.page.width - 100,
                        lineGap: 2,
                        paragraphGap: 3
                    }
                );

            continue;
        }


        // ============================
        // NUMBERED LIST
        // ============================

        const numberedMatch =
            /^\s*(\d+)[.)]\s+(.+)$/.exec(
                line
            );

        if (numberedMatch) {

            doc
                .font('Helvetica')
                .fontSize(10.5)
                .fillColor('#222222')
                .text(
                    `${numberedMatch[1]}. ${numberedMatch[2]}`,
                    {
                        indent: 18,
                        width: doc.page.width - 100,
                        lineGap: 2,
                        paragraphGap: 3
                    }
                );

            continue;
        }


        // ============================
        // NORMAL TEXT
        // ============================

        doc
            .font('Helvetica')
            .fontSize(10.5)
            .fillColor('#222222')
            .text(
                line,
                {
                    width: doc.page.width - 100,
                    lineGap: 3,
                    paragraphGap: 3
                }
            );
    }
}


function renderCodeLine(
    doc: any,
    line: string
): void {

    const x = 55;
    const width = doc.page.width - 110;

    const lineHeight = 14;

    const y = doc.y;

    // Make sure the code doesn't run into the footer
    if (
        y + lineHeight >
        doc.page.height - 85
    ) {
        doc.addPage();
    }

    const actualY = doc.y;

    // Code background
    doc
        .save()
        .fillColor('#F4F4F4')
        .roundedRect(
            x,
            actualY - 2,
            width,
            lineHeight + 2,
            3
        )
        .fill()
        .restore();

    // Code text
    doc
        .font('Courier')
        .fontSize(8.5)
        .fillColor('#333333')
        .text(
            line || ' ',
            x + 7,
            actualY,
            {
                width: width - 14,
                lineGap: 1,
                lineBreak: true
            }
        );

    doc.moveDown(0.05);
}


function addPageNumbers(doc: any): void {

    const range = doc.bufferedPageRange();

    for (
        let i = range.start;
        i < range.start + range.count;
        i++
    ) {

        doc.switchToPage(i);

        const pageNumber =
            `Page ${i - range.start + 1}`;

        doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#777777');

        // Draw footer without allowing PDFKit
        // to create a new page.
        doc.save();

        doc.text(
            pageNumber,
            50,
            doc.page.height - 55,
            {
                width: doc.page.width - 100,
                align: 'center',
                lineBreak: false,
                height: 10
            }
        );

        doc.restore();
    }
}


export function deactivate() {}