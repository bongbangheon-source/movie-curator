import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

// 실제 브라우저와 OpenAI API를 사용합니다. API 사용 요금이 발생합니다.
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
mkdirSync("test-results", { recursive: true });

try {
  for (const [type, label] of [["movie", "영화"], ["music", "음악"], ["both", "둘 다"]]) {
    await page.setViewportSize(type === "both" ? { width: 375, height: 812 } : { width: 1280, height: 900 });
    await page.goto(baseURL);
    await page.getByLabel("기분", { exact: true }).fill("따뜻함");
    await page.getByLabel("영화 최대 상영시간 (분)").fill("90");
    await page.getByRole("radio", { name: label, exact: true }).check();
    const received = page.waitForResponse((response) => response.url().endsWith("/api/recommend") && response.request().method() === "POST", { timeout: 200_000 });
    await page.getByRole("button", { name: "추천받기", exact: true }).click();
    await expect(page.getByRole("button", { name: "추천 중…" })).toBeDisabled();
    const response = await received;
    const body = await response.json();
    assert.equal(response.status(), 200, body.error);
    assert.equal(response.request().postDataJSON().recommendationType, type);
    assert.equal(response.request().postDataJSON().maxRuntime, 90);
    await expect(page.getByRole("status")).toHaveText("추천이 완료되었습니다.");
    const names = type === "movie" ? ["search_movies"] : type === "music" ? ["search_music"] : ["search_movies", "search_music"];
    assert.deepEqual(body.toolCalls.map((trace) => trace.name).sort(), names.sort());
    const history = page.getByRole("region", { name: "AI Agent 실행 기록" });
    for (const name of names) await expect(history).toContainText(name);
    const items = [...body.recommendations.movies, ...body.recommendations.music];
    const cards = page.getByRole("region", { name: "추천 결과 내용" }).getByRole("article");
    await expect(cards).toHaveCount(items.length);
    assert.ok(items.length > 0);
    for (const item of items) {
      const card = cards.filter({ has: page.getByRole("heading", { name: item.title, exact: true }) });
      await expect(card).toContainText(item.genres.join(" · "));
      await expect(card).toContainText(item.reason);
      await expect(card).toContainText("runtimeMinutes" in item ? `${item.runtimeMinutes}분` : item.artist);
      if ("runtimeMinutes" in item) assert.ok(item.runtimeMinutes <= 90);
      const { reason, ...record } = item;
      assert.deepEqual(record, body.toolCalls.flatMap((trace) => trace.result).find((row) => row.id === item.id));
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `test-results/live-${type}.png`, fullPage: true });
    console.log(JSON.stringify({ type, status: response.status(), functions: names, movieCards: body.recommendations.movies.length, musicCards: body.recommendations.music.length, browserErrors: errors.length }));
  }
} finally {
  await browser.close();
}
