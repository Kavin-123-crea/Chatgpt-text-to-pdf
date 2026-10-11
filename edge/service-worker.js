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

    await chrome.storage.local.set({ chatPdfConversation: result });
    await chrome.tabs.create({ url: chrome.runtime.getURL("print.html") });
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

function extractConversationFromPage() {
  const modern = [...document.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')];
  const candidates = modern.length ? modern : [
    ...document.querySelectorAll('[data-user-message-bubble="true"], [data-markdown-text-style="assistant-message"]')
  ];

  const messages = candidates
    .filter((element) => !candidates.some((other) => other !== element && other.contains(element)))
    .map((element) => {
      const author = element.getAttribute("data-message-author-role");
      const role = author || (element.matches('[data-user-message-bubble="true"]') ? "user" : "assistant");
      const clone = element.cloneNode(true);
      clone.querySelectorAll('button, [role="button"], [data-testid*="action"], [data-testid*="toolbar"], script, style').forEach((node) => node.remove());
      return { role, html: clone.innerHTML };
    })
    .filter((message) => message.html.trim());

  return {
    title: document.title.replace(/\s*[|–-]\s*ChatGPT\s*$/i, "").trim() || "ChatGPT Conversation",
    url: location.href,
    messages
  };
}
