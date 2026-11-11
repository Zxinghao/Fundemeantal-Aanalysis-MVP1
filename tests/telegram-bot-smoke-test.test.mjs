import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSupplyChainBot } from "../scripts/telegram-bot-smoke-test.mjs";

test("dedicated bot checks identity then sends one test message", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ endpoint: url.split("/").at(-1), body: JSON.parse(opts.body) });
    if (url.endsWith("/getMe")) return { ok: true, status: 200, json: async () => ({
      ok: true, result: { id: 1, is_bot: true, username: "SupplyChainExample_bot" }
    }) };
    if (url.endsWith("/sendMessage")) return { ok: true, status: 200, json: async () => ({
      ok: true, result: { message_id: 123 }
    }) };
    throw new Error("unexpected endpoint");
  };
  const result = await checkSupplyChainBot({ token: "test-token", chatId: "42", fetchImpl });
  assert.deepEqual(result, { botUsername: "SupplyChainExample_bot", sent: true });
  assert.deepEqual(calls.map(x => x.endpoint), ["getMe", "sendMessage"]);
  assert.equal(calls[1].body.chat_id, "42");
  assert.match(calls[1].body.text, /Supply Chain/);
});

test("bad token and unavailable chat produce safe diagnostic messages", async () => {
  const unauthorized = async () => ({ ok: false, status: 401 });
  await assert.rejects(checkSupplyChainBot({ token: "secret", chatId: "42", fetchImpl: unauthorized }), /rejected the bot token/);
  const failChat = async (url) => url.endsWith("getMe") ?
    { ok: true, status: 200, json: async () => ({ ok: true, result: { is_bot: true, username: "bot" } }) } :
    { ok: false, status: 400 };
  await assert.rejects(checkSupplyChainBot({ token: "secret", chatId: "42", fetchImpl: failChat }), /chat destination/);
});

test("missing credentials fail before network calls", async () => {
  await assert.rejects(checkSupplyChainBot({ token: "", chatId: "42" }), /BOT_TOKEN/);
  await assert.rejects(checkSupplyChainBot({ token: "test", chatId: "" }), /CHAT_ID/);
});

test("network failure does not reveal secret URL", async () => {
  await assert.rejects(checkSupplyChainBot({
    token: "TOP-SECRET", chatId: "42",
    fetchImpl: async () => { throw new Error("https://api.telegram.org/botTOP-SECRET/getMe leaked"); }
  }), (error) => !error.message.includes("TOP-SECRET") && /Network connection/.test(error.message));
});
