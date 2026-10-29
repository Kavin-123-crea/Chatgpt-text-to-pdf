const ALLOWED_TAGS = new Set([
  "A", "B", "BLOCKQUOTE", "BR", "CODE", "DEL", "DIV", "EM", "FIGCAPTION", "FIGURE",
  "H1", "H2", "H3", "H4", "H5", "H6", "HR", "I", "IMG", "LI", "OL", "P", "PRE",
  "S", "SPAN", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TD", "TH", "THEAD", "TR", "U", "UL"
]);

function safeUrl(value, image = false) {
  try {
    const url = new URL(value, location.href);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    if (image && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)) return value;
  } catch { /* Drop malformed URLs. */ }
  return "";
}

function appendSafeHtml(target, html) {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const clean = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }
      const element = child;
      if (!ALLOWED_TAGS.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      const href = element.tagName === "A" ? safeUrl(element.getAttribute("href")) : "";
      const src = element.tagName === "IMG" ? safeUrl(element.getAttribute("src"), true) : "";
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
      if (href) {
        element.setAttribute("href", href);
        element.setAttribute("rel", "noreferrer noopener");
      }
      if (src) {
        element.setAttribute("src", src);
        element.setAttribute("alt", "");
      } else if (element.tagName === "IMG") {
        element.remove();
        continue;
      }
      clean(element);
    }
  };
  clean(parsed.body);

  // Long code wrapped in a single Markdown backtick is exported as inline
  // <code>, even when it is really a pasted program. Give it a wrapping block
  // so it remains readable in the PDF. Original missing newlines cannot be
  // inferred, but whitespace that is present will be retained.
  parsed.body.querySelectorAll("code:not(pre code)").forEach((code) => {
    if (code.textContent.trim().length < 300) return;
    const block = document.createElement("pre");
    block.className = "long-inline-code";
    code.replaceWith(block);
    block.append(code);
  });

  target.append(...parsed.body.childNodes);
}

async function renderConversation() {
  const exportId = new URLSearchParams(location.search).get("export");
  const storageKey = exportId && /^[0-9a-f-]{36}$/i.test(exportId) ? `chatPdfConversation:${exportId}` : "";
  const stored = storageKey ? await chrome.storage.local.get(storageKey) : {};
  const conversation = storageKey ? stored[storageKey] : null;
  if (storageKey && conversation) await chrome.storage.local.remove(storageKey);
  const root = document.querySelector("#document");
  if (!conversation?.messages?.length) {
    root.textContent = "No exported conversation was found. Return to ChatGPT and click the extension again.";
    document.querySelector("#print").disabled = true;
    return;
  }

  document.title = `${conversation.title} - PDF`;
  const heading = document.createElement("h1");
  heading.textContent = conversation.title;
  root.replaceChildren(heading);

  conversation.messages.forEach((message) => {
    const section = document.createElement("section");
    section.className = `message ${message.role === "user" ? "user" : "assistant"}`;
    const label = document.createElement("h2");
    label.textContent = message.role === "user" ? "You" : message.role === "selection" ? "Selected text" : "ChatGPT";
    const content = document.createElement("div");
    content.className = "message-content";
    appendSafeHtml(content, message.html);
    section.append(label, content);
    root.append(section);
  });
}

document.querySelector("#print").addEventListener("click", () => window.print());
renderConversation().catch((error) => {
  console.error(error);
  document.querySelector("#document").textContent = "Could not prepare this conversation. Close this tab and try again.";
});
