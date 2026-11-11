// Manual connectivity check for the dedicated Supply Chain Telegram bot.
// Run from GitHub Actions with private SUPPLY_CHAIN_TELEGRAM_BOT_TOKEN and
// SUPPLY_CHAIN_TELEGRAM_CHAT_ID secrets. Never log credentials or chat ID.
const API_BASE = "https://api.telegram.org/bot";

function explainFailure(step, status) {
  if (status === 401 || status === 404) {
    return "Telegram rejected the bot token. Verify the dedicated Supply Chain bot token in GitHub Actions Secrets (do not paste it into logs or chat).";
  }
  if (status === 403) {
    return "Telegram cannot message this chat. Open the NEW bot directly in Telegram, send /start, and ensure it is not blocked.";
  }
  if (status === 400) {
    return step === "sendMessage"
      ? "Telegram rejected the chat destination. Check SUPPLY_CHAIN_TELEGRAM_CHAT_ID and send /start to the NEW bot first."
      : "Telegram rejected the getMe request. Check the Supply Chain bot token.";
  }
  return "Telegram " + step + " failed with HTTP " + status + ".";
}

async function requestTelegram(step, token, payload, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(API_BASE + token + "/" + step, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // A network error can contain a URL with the secret token. Never print it.
    throw new Error("Network connection to Telegram failed; credentials were not logged.");
  }
  if (!response.ok) throw new Error(explainFailure(step, response.status));
  let json;
  try { json = await response.json(); }
  catch { throw new Error("Telegram returned a response that is not valid JSON."); }
  if (json?.ok !== true) {
    const code = Number(json?.error_code) || response.status;
    throw new Error(explainFailure(step, code));
  }
  return json.result;
}

export async function checkSupplyChainBot({ token, chatId, fetchImpl = fetch }) {
  if (!token || !String(token).trim()) throw new Error("SUPPLY_CHAIN_TELEGRAM_BOT_TOKEN secret is missing.");
  if (!chatId || !String(chatId).trim()) throw new Error("SUPPLY_CHAIN_TELEGRAM_CHAT_ID secret is missing.");
  const bot = await requestTelegram("getMe", token, {}, fetchImpl);
  if (!bot?.is_bot || typeof bot.username !== "string") {
    throw new Error("getMe did not return a valid Telegram bot identity.");
  }
  const result = await requestTelegram("sendMessage", token, {
    chat_id: chatId,
    text: "✅ Supply Chain Bottleneck Radar\n专属 Telegram Bot 已连接成功。\n这是一条手动连接测试消息，不代表 Claude/Codex 已经开始研究或发现新事件。",
    disable_web_page_preview: true
  }, fetchImpl);
  if (!result?.message_id) throw new Error("Telegram reported success but returned no message ID.");
  return { botUsername: bot.username, sent: true };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  checkSupplyChainBot({
    token: process.env.SUPPLY_CHAIN_TELEGRAM_BOT_TOKEN,
    chatId: process.env.SUPPLY_CHAIN_TELEGRAM_CHAT_ID
  })
    .then(({ botUsername }) => console.log("Success: Telegram bot @" + botUsername +
      " is valid and sent a private test message. No credentials or chat ID were printed."))
    .catch((error) => {
      console.error("Supply Chain Telegram test failed: " + error.message);
      process.exitCode = 1;
    });
}
