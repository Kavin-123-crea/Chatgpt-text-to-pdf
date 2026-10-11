import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

import { containsMojibake, createChatGPTHtmlPdf, repairKnownMojibake, splitTextForEmojiFallback, stripUnsupportedEmoji } from './chatgptHtmlPdf';

function extractTextCoordinates(pdfBuffer: Buffer): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const streamMatches = [
        ...pdfBuffer.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)
    ];

    for (const match of streamMatches) {
        try {
            const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1'));
            const decoded = inflated.toString('latin1');
            const textLayout = /((?:\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?)\s+Tm)/g;
            let matchResult: RegExpExecArray | null;

            while ((matchResult = textLayout.exec(decoded)) !== null) {
                const line = decoded.slice(matchResult.index);
                const coords = /^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+Tm/m.exec(line);

                if (coords) {
                    points.push({ x: Number(coords[1]), y: Number(coords[2]) });
                }
            }
        } catch {
            // Ignore compressed streams that are not text payloads.
        }
    }

    return points;
}

function extractTextYPositions(pdfBuffer: Buffer): number[] {
    const yPositions: number[] = [];
    const streamMatches = [
        ...pdfBuffer.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)
    ];

    for (const match of streamMatches) {
        try {
            const inflated = zlib.inflateSync(Buffer.from(match[1], 'latin1'));
            const decoded = inflated.toString('latin1');
            const textLayout = /((?:\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?)\s+Tm)/g;
            let matchResult: RegExpExecArray | null;

            while ((matchResult = textLayout.exec(decoded)) !== null) {
                const line = decoded.slice(matchResult.index);
                const coords = /^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+Tm/m.exec(line);

                if (coords) {
                    yPositions.push(Number(coords[2]));
                }
            }
        } catch {
            // Ignore compressed streams that are not text payloads.
        }
    }

    return yPositions;
}

function extractVectorCurveCommandCount(pdfBuffer: Buffer): number {
    let count = 0;
    const streamMatches = [
        ...pdfBuffer.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)
    ];

    for (const match of streamMatches) {
        try {
            const decoded = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
            count += decoded.match(/(?:^|\s)c(?=\s|$)/gm)?.length ?? 0;
        } catch {
            // Ignore compressed streams that are not text payloads.
        }
    }

    return count;
}

test('emoji text is split into emoji-aware segments', () => {
    const segments = splitTextForEmojiFallback('Hello 😀 world');

    assert.deepEqual(
        segments.map((segment) => ({
            text: segment.text,
            useEmojiFont: segment.useEmojiFont
        })),
        [
            { text: 'Hello ', useEmojiFont: false },
            { text: '😀', useEmojiFont: true },
            { text: ' world', useEmojiFont: false }
        ]
    );
});

test('emoji-like characters are stripped when text is unsafe or unsupported', () => {
    const sanitized = stripUnsupportedEmoji('Hello 👍 world');

    assert.equal(sanitized.replace(/\s+/g, ' ').trim(), 'Hello world');
});

test('clipboard encoding detection allows Unicode punctuation and catches mojibake sequences', () => {
    assert.equal(containsMojibake('Product Layout — Summary'), false);
    assert.equal(containsMojibake('Product Layout â€” Summary'), true);
});

test('known corrupted dash sequences are repaired before clipboard validation', () => {
    const repaired = repairKnownMojibake(
        'Product Layout â€” Summary: Pages 44â€“45'
    );

    assert.equal(repaired, 'Product Layout — Summary: Pages 44–45');
    assert.equal(containsMojibake(repaired), false);
});

test('display LaTeX formulas render into PDF vector paths', async () => {
    const outputPath = path.join(
        os.tmpdir(),
        `chatgpt-display-math-${Date.now()}.pdf`
    );
    const html = `
        <!doctype html>
        <html>
            <body>
                <h2>Number of Orders per Year</h2>
                <span data-math-source="\\boxed{n=\\frac{D}{Q}}" data-math-display="true">equation</span>
            </body>
        </html>
    `;

    await createChatGPTHtmlPdf(outputPath, html, {
        title: 'Display math test',
        includePageNumbers: false
    });

    const curveCommands = extractVectorCurveCommandCount(fs.readFileSync(outputPath));
    assert.ok(
        curveCommands > 10,
        `Expected the boxed equation to produce vector paths, but found ${curveCommands} curve commands.`
    );
});

test('math symbols in notation tables render as typeset formulas', async () => {
    const outputPath = path.join(
        os.tmpdir(),
        `chatgpt-math-symbol-table-${Date.now()}.pdf`
    );
    const symbols = ['D', '\\sigma_D', 'L', 'D_L', '\\sigma_L'];
    const rows = symbols
        .map((source) =>
            `<tr><td><span data-math-source="${source}" data-math-display="false">equation</span></td><td>Symbol meaning</td></tr>`
        )
        .join('');
    const html = `<!doctype html><html><body><table><tr><th>Symbol</th><th>Meaning</th></tr>${rows}</table></body></html>`;

    await createChatGPTHtmlPdf(outputPath, html, {
        title: 'Math symbol table test',
        includePageNumbers: false
    });

    const curveCommands = extractVectorCurveCommandCount(fs.readFileSync(outputPath));
    assert.ok(
        curveCommands > 20,
        `Expected five table symbols to produce vector math paths, but found ${curveCommands} curve commands.`
    );
});

test('product layout summary table keeps its two columns aligned', async () => {
    const outputPath = path.join(
        os.tmpdir(),
        `chatgpt-summary-table-${Date.now()}.pdf`
    );
    const rows = [
        ['Feature', 'Product Layout'],
        ['Volume', 'High'],
        ['Variety', 'Low'],
        ['Production', 'Repetitive / Continuous'],
        ['Arrangement', 'According to product sequence'],
        ['Material flow', 'Smooth'],
        ['Material handling', 'Low'],
        ['Production control', 'Simple'],
        ['Equipment', 'Specialized / Automated'],
        ['Flexibility', 'Lower'],
        ['Main advantage', 'Rapid throughput'],
        ['Main limitation', 'High investment and low flexibility']
    ];
    const tableHtml = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('');
    const html = `<!doctype html><html><body><table>${tableHtml}</table></body></html>`;

    await createChatGPTHtmlPdf(outputPath, html, {
        title: 'Product layout summary table test',
        includePageNumbers: false
    });

    const coordinates = extractTextCoordinates(fs.readFileSync(outputPath));
    const firstColumnRows = new Set(
        coordinates
            .filter(({ x }) => Math.abs(x - 53) < 1)
            .map(({ y }) => Math.round(y * 10) / 10)
    );
    const secondColumnRows = new Set(
        coordinates
            .filter(({ x }) => Math.abs(x - 300.5) < 1)
            .map(({ y }) => Math.round(y * 10) / 10)
    );
    const alignedRows = [...firstColumnRows].filter((y) => secondColumnRows.has(y));

    assert.ok(
        alignedRows.length >= rows.length,
        `Expected both table columns to share a baseline for all ${rows.length} rows, but found ${alignedRows.length}.`
    );
});

test('chatgpt HTML paragraphs render on separate lines instead of merging together', async () => {
    const outputPath = path.join(
        os.tmpdir(),
        `chatgpt-paragraph-${Date.now()}.pdf`
    );

    const html = `
        <!doctype html>
        <html>
            <body>
                <div data-markdown-text-style="assistant-message">
                    <p>First paragraph should appear above the next block.</p>
                    <p>Second paragraph should start on a fresh line instead of being merged with the first one.</p>
                </div>
            </body>
        </html>
    `;

    await createChatGPTHtmlPdf(outputPath, html, {
        title: 'Paragraph layout test',
        includePageNumbers: false
    });

    const pdf = fs.readFileSync(outputPath);
    const yPositions = extractTextYPositions(pdf);

    assert.ok(yPositions.length >= 4, `Expected text positioning metadata, but got ${yPositions.length} values.`);

    const distinctY = new Set(yPositions.map((y) => Math.round(y * 10) / 10));

    assert.ok(
        distinctY.size > 1,
        `Expected separate paragraph rows, but the generated text stayed on the same y-position: ${Array.from(distinctY).join(', ')}`
    );

    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);

    assert.ok(
        maxY - minY > 12,
        `Expected paragraphs to be vertically separated by a full line gap, but the y range was only ${maxY - minY}.`
    );
});

test('unordered list items stay indented after the bullet marker instead of aligning to the margin', async () => {
    const outputPath = path.join(
        os.tmpdir(),
        `chatgpt-list-indent-${Date.now()}.pdf`
    );

    const html = `
        <!doctype html>
        <html>
            <body>
                <h1>8. Advantages of Product Layout</h1>
                <ol>
                    <li><strong>Low variable cost per unit</strong> for high-volume, standardized products, followed by enough detail to wrap this numbered item onto a second line without overlapping the next item.</li>
                    <li>Second numbered item starts below the wrapped line.</li>
                </ol>
                <p>They are used for:</p>
                <ul>
                    <li>Repetitive production</li>
                    <li>Continuous production</li>
                </ul>
                <p>Following paragraph starts at the content margin.</p>
            </body>
        </html>
    `;

    await createChatGPTHtmlPdf(outputPath, html, {
        title: 'List indent test',
        includePageNumbers: false
    });

    const coordinates = extractTextCoordinates(fs.readFileSync(outputPath));
    const firstMarkerIndex = coordinates.findIndex(({ x }) => Math.abs(x - 52) < 0.5);
    const secondMarkerIndex = coordinates.findIndex(
        ({ x }, index) => index > firstMarkerIndex && Math.abs(x - 52) < 0.5
    );

    assert.ok(
        firstMarkerIndex >= 0 && secondMarkerIndex > firstMarkerIndex,
        'Expected the first two numbered list markers to be captured.'
    );

    assert.ok(
        coordinates.some(
            ({ x, y }) =>
                Math.abs(x - 74) < 0.5 &&
                Math.abs(y - coordinates[firstMarkerIndex].y) < 0.1
        ),
        'Expected the list item text to share a baseline with its marker.'
    );

    const firstItemRows = coordinates
        .slice(firstMarkerIndex + 1, secondMarkerIndex)
        .filter(({ x }) => Math.abs(x - 74) < 0.5)
        .map(({ y }) => Math.round(y * 10) / 10);

    assert.ok(
        new Set(firstItemRows).size > 1,
        'Expected the first numbered item to wrap onto multiple aligned rows.'
    );
    assert.ok(
        coordinates[secondMarkerIndex].y < Math.min(...firstItemRows),
        'Expected the second marker to follow the final wrapped line of the first item.'
    );

    assert.equal(
        coordinates.at(-1)?.x,
        50,
        'Expected the paragraph after the list to return to the content margin.'
    );
});

test('definition paragraphs keep the lead text and emphasized product name on the same line', async () => {
    const outputPath = path.join(
        os.tmpdir(),
        `chatgpt-definition-line-${Date.now()}.pdf`
    );

    const html = `
        <!doctype html>
        <html>
            <body>
                <div data-markdown-text-style="assistant-message">
                    <p>
                        A <strong>product layout</strong> is an arrangement of resources in which the order of resources exactly follows the process sequence dictated by the product.
                    </p>
                </div>
            </body>
        </html>
    `;

    await createChatGPTHtmlPdf(outputPath, html, {
        title: 'Definition alignment test',
        includePageNumbers: false
    });

    const coordinates = extractTextCoordinates(fs.readFileSync(outputPath));
    const roleIndex = coordinates.findIndex(({ x }) => Math.abs(x - 62) < 0.5);
    const firstBodyRun = coordinates[roleIndex + 1];

    assert.ok(
        firstBodyRun &&
            coordinates.slice(roleIndex + 2).some(
                ({ x, y }) =>
                    Math.abs(y - firstBodyRun.y) < 0.1 && x > firstBodyRun.x + 1
            ),
        'Expected the emphasized product name to continue on the lead text line.'
    );
});
