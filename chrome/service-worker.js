chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(tab.url || "")) {
    await chrome.tabs.create({ url: "https://chatgpt.com/" });
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractConversationFromPage
    });

    if (!result?.messages?.length) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert("No conversation messages were found. Open a ChatGPT conversation and try again.")
      });
      return;
    }

    await openExport(result);
  } catch (error) {
    console.error("Could not export the ChatGPT conversation", error);
    if (tab.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert("Could not read this ChatGPT page. Refresh it, then try the extension again.")
      }).catch(() => {});
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "chat-selection-to-pdf",
      title: "Convert selection to PDF",
      contexts: ["selection"],
      documentUrlPatterns: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "chat-selection-to-pdf" || !tab?.id) return;

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractSelectedHtml
    });
    if (!result?.html?.trim()) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert("Select some chat text first, then right-click and choose Convert selection to PDF.")
      });
      return;
    }

    await openExport({
      title: `${result.title} - Selection`,
      url: result.url,
      messages: [{ role: "selection", html: result.html }]
    });
  } catch (error) {
    console.error("Could not export the selected ChatGPT text", error);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => alert("Could not read the selected text. Select it again and retry.")
    }).catch(() => {});
  }
});

async function openExport(conversation) {
  // Keep one fresh snapshot per export and discard leftover conversation data.
  const exportId = crypto.randomUUID();
  const previous = await chrome.storage.local.get(null);
  const oldSnapshotKeys = Object.keys(previous).filter((key) => key.startsWith("chatPdfConversation:"));
  if (oldSnapshotKeys.length) await chrome.storage.local.remove(oldSnapshotKeys);
  await chrome.storage.local.set({ [`chatPdfConversation:${exportId}`]: conversation });
  await chrome.tabs.create({ url: `${chrome.runtime.getURL("print.html")}?export=${exportId}` });
}

function extractSelectedHtml() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return null;
  const container = document.createElement("div");
  for (let i = 0; i < selection.rangeCount; i++) {
    container.append(selection.getRangeAt(i).cloneContents());
  }
  container.querySelectorAll('button, [role="button"], script, style, svg').forEach((node) => node.remove());
  const html = container.innerHTML.trim() || selection.toString().replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  return {
    title: document.title.replace(/\s*[|–-]\s*ChatGPT\s*$/i, "").trim() || "ChatGPT Conversation",
    url: location.href,
    html
  };
}

async function extractConversationFromPage() {
  const selector = '[data-message-author-role="user"], [data-message-author-role="assistant"], [data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]';
  // Keep extraction inside ChatGPT's conversation landmark. Page-wide queries
  // can also match hidden or stale message trees on very long conversations.
  const conversationRoot = document.querySelector("main") || document.body;
  const getMessages = () => {
    let candidates = [...conversationRoot.querySelectorAll(selector)]
      .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    // ChatGPT has used article conversation-turn wrappers in some page builds.
    // Fall back to those wrappers when its role attributes are absent/changed.
    if (!candidates.length) {
      candidates = [...conversationRoot.querySelectorAll('article[data-testid^="conversation-turn"]')]
        .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    }
    const leaves = candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
    return leaves.map((element) => {
      const author = element.getAttribute("data-message-author-role") || element.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role");
      const isUser = element.matches('[data-user-message-bubble="true"]') || element.querySelector('[data-user-message-bubble="true"]') || /conversation-turn-user/i.test(element.getAttribute("data-testid") || "");
      const role = author || (isUser ? "user" : "assistant");
      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], [data-testid*="action"], [data-testid*="toolbar"], script, style').forEach((node) => node.remove());
      return { role, html: clone.innerHTML.trim() };
    }).filter((message) => message.html);
  };

  // ChatGPT virtualizes long chats. Walk upward to trigger loading older turns,
  // retaining each visible batch, then restore the user's original position.
  const first = conversationRoot.querySelector(selector) || conversationRoot.querySelector('article[data-testid^="conversation-turn"]');
  let scroller = first?.parentElement;
  while (scroller && scroller !== document.body && scroller !== document.documentElement && scroller.scrollHeight <= scroller.clientHeight + 1) scroller = scroller.parentElement;
  if (!scroller || scroller === document.body || scroller === document.documentElement) scroller = document.scrollingElement;
  const originalTop = scroller?.scrollTop || 0;
  const captured = [];
  const seen = new Set();
  const collect = () => {
    const batch = getMessages().filter((message) => {
      const key = `${message.role}:${message.html}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (batch.length) captured.unshift(...batch);
  };
  collect();
  if (scroller) {
    let stableAtTop = 0;
    for (let i = 0; i < 80 && stableAtTop < 3; i++) {
      const previousTop = scroller.scrollTop;
      const previousCount = captured.length;
      scroller.scrollTop = Math.max(0, previousTop - Math.max(300, scroller.clientHeight * 0.75));
      await new Promise((resolve) => setTimeout(resolve, 180));
      collect();
      stableAtTop = scroller.scrollTop === 0 && captured.length === previousCount ? stableAtTop + 1 : 0;
    }
    scroller.scrollTop = originalTop;
  }
  const messages = captured;

  return {
    title: document.title.replace(/\s*[|–-]\s*ChatGPT\s*$/i, "").trim() || "ChatGPT Conversation",
    url: location.href,
    messages
  };
}
