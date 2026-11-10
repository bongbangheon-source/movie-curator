import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 실행 중인 로컬 서버로 실제 OpenAI 요청을 보냅니다. API 사용 요금이 발생합니다.
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:3100";
const movies = JSON.parse(readFileSync(new URL("../data/movies.json", import.meta.url), "utf8"));
const music = JSON.parse(readFileSync(new URL("../data/music.json", import.meta.url), "utf8"));

for (const recommendationType of ["movie", "music", "both"]) {
  const response = await fetch(`${baseURL}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recommendationType, mood: "따뜻함", maxRuntime: 90,
      request: "따뜻하고 편안한 분위기의 작품을 추천해 주세요.",
    }),
    signal: AbortSignal.timeout(200_000),
  });
  const result = await response.json();
  assert.equal(response.status, 200, result.error || "HTTP request failed");
  const expected = recommendationType === "movie" ? ["search_movies"]
    : recommendationType === "music" ? ["search_music"] : ["search_movies", "search_music"];
  assert.deepEqual(result.toolCalls.map((trace) => trace.name).sort(), expected.sort());
  for (const trace of result.toolCalls) {
    const originals = trace.name === "search_movies" ? movies : music;
    for (const record of trace.result) {
      assert.deepEqual(record, originals.find((item) => item.id === record.id));
      if (trace.name === "search_movies") assert.ok(record.runtimeMinutes <= 90);
    }
  }
  for (const [kind, name] of [["movies", "search_movies"], ["music", "search_music"]]) {
    const candidates = result.toolCalls.find((trace) => trace.name === name)?.result ?? [];
    const recommendations = result.recommendations[kind];
    if (candidates.length) assert.ok(recommendations.length > 0);
    else assert.equal(recommendations.length, 0);
    for (const { reason, ...record } of recommendations) {
      assert.ok(reason.trim());
      assert.deepEqual(record, candidates.find((item) => item.id === record.id));
    }
  }
  console.log(JSON.stringify({
    type: recommendationType, status: response.status,
    toolCalls: result.toolCalls.map(({ name, arguments: args, result }) => ({ name, arguments: args, count: result.length })),
    recommendations: [...result.recommendations.movies, ...result.recommendations.music]
      .map(({ id, title, reason }) => ({ id, title, reason })),
  }));
}
