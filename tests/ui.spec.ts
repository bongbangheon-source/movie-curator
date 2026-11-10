import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const movie = JSON.parse(readFileSync("data/movies.json", "utf8"))[0];
const music = JSON.parse(readFileSync("data/music.json", "utf8"))[0];

function responseFor(type: string) {
  const movies = type === "music" ? [] : [{ ...movie, reason: "따뜻한 이야기가 취향에 맞습니다." }];
  const songs = type === "movie" ? [] : [{ ...music, reason: "차분한 곡이라 추천합니다." }];
  return {
    recommendations: { movies, music: songs },
    toolCalls: [
      ...(type !== "music" ? [{ name: "search_movies", arguments: { mood: "따뜻함", maxRuntimeMinutes: 90 }, result: [movie] }] : []),
      ...(type !== "movie" ? [{ name: "search_music", arguments: { mood: "따뜻함" }, result: [music] }] : []),
    ],
  };
}

for (const [type, label] of [["movie", "영화"], ["music", "음악"], ["both", "둘 다"]]) {
  test(`${label}: sends form values and displays cards and agent history`, async ({ page }) => {
    let payload: unknown;
    await page.route("**/api/recommend", async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: responseFor(type) });
    });
    await page.goto("/");
    await page.getByLabel("기분", { exact: true }).fill("따뜻함");
    await page.getByLabel("선호 장르").fill("드라마");
    await page.getByLabel("좋아하는 영화 또는 가수").fill("골목 끝 우체통");
    await page.getByRole("radio", { name: label, exact: true }).check();
    await page.getByLabel("영화 최대 상영시간 (분)").fill("90");
    await page.getByLabel("자유 요청 문장").fill("편안한 작품");
    await page.getByRole("button", { name: "추천받기", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("추천이 완료되었습니다.");
    expect(payload).toEqual({ mood: "따뜻함", genre: "드라마", favorite: "골목 끝 우체통", recommendationType: type, maxRuntime: 90, request: "편안한 작품" });
    const cards = page.getByRole("region", { name: "추천 결과 내용" }).getByRole("article");
    await expect(cards).toHaveCount(type === "both" ? 2 : 1);
    if (type !== "music") {
      await expect(cards.filter({ hasText: movie.title })).toContainText("85분");
      await expect(cards.filter({ hasText: movie.title })).toContainText("드라마");
      await expect(cards.filter({ hasText: movie.title })).toContainText("따뜻한 이야기가 취향에 맞습니다.");
    }
    if (type !== "movie") {
      await expect(cards.filter({ hasText: music.title })).toContainText(music.artist);
      await expect(cards.filter({ hasText: music.title })).toContainText("팝");
    }
    const history = page.getByRole("region", { name: "AI Agent 실행 기록" });
    for (const trace of responseFor(type).toolCalls) await expect(history).toContainText(trace.name);
  });
}

test("pending submission shows status and blocks duplicate requests", async ({ page }) => {
  let finish!: () => void;
  let count = 0;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  await page.route("**/api/recommend", async (route) => {
    count++;
    await pending;
    await route.fulfill({ json: responseFor("both") });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "추천받기", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("추천을 준비하고 있습니다");
  await expect(page.getByRole("button", { name: "추천 중…" })).toBeDisabled();
  await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
  finish();
  await expect(page.getByRole("status")).toHaveText("추천이 완료되었습니다.");
  expect(count).toBe(1);
});

test("empty runtime is omitted and empty results have clear guidance", async ({ page }) => {
  let payload: Record<string, unknown> = {};
  await page.route("**/api/recommend", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: {
      recommendations: { movies: [], music: [] },
      toolCalls: [{ name: "search_movies", arguments: {}, result: [] }],
    } });
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "영화", exact: true }).check();
  await page.getByRole("button", { name: "추천받기", exact: true }).click();
  await expect(page.getByRole("region", { name: "추천 결과 내용" })).toContainText("조건에 맞는 영화가 없습니다");
  expect(payload).not.toHaveProperty("maxRuntime");
  await expect(page.getByRole("region", { name: "AI Agent 실행 기록" })).toContainText("0개");
});

for (const failure of ["server", "network", "invalid-json"]) {
  test(`shows a readable ${failure} error and re-enables submit`, async ({ page }) => {
    await page.route("**/api/recommend", async (route) => {
      if (failure === "network") await route.abort();
      else if (failure === "invalid-json") await route.fulfill({ body: "invalid" });
      else await route.fulfill({ status: 503, json: { error: "서버가 잠시 혼잡합니다." } });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "추천받기", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "추천을 불러오지 못했습니다" })).toBeVisible();
    await expect(page.getByRole("button", { name: "추천받기", exact: true })).toBeEnabled();
    await expect(page.getByRole("article")).toHaveCount(0);
  });
}

test("mobile cards and history fit a 375px viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/recommend", (route) => route.fulfill({ json: responseFor("both") }));
  await page.goto("/");
  await page.getByRole("button", { name: "추천받기", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
});
