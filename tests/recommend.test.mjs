import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/recommend/route.ts";

const call = (name, args = {}) => ({
  type: "function_call", name, call_id: `call_${name}`,
  arguments: JSON.stringify(name === "search_movies"
    ? { genre: null, mood: null, maxRuntimeMinutes: null, ...args }
    : { genre: null, mood: null, energyLevel: null, ...args }),
});
const final = (movies = [], music = []) => ({ type: "message", content: [
  { type: "output_text", text: JSON.stringify({ movies, music }) },
] });

function mockOpenAI(t, outputs) {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-never-sent";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    requests.push(JSON.parse(options.body));
    assert.ok(outputs.length, "unexpected extra OpenAI request");
    const output = outputs.shift();
    return output instanceof Response ? output : Response.json({ status: "completed", output });
  });
  return requests;
}

const preferences = {
  mood: "따뜻함", genre: "드라마", favorite: "골목 끝 우체통",
  recommendationType: "both", maxRuntime: 90, request: "편안한 작품을 원해요",
};

function send(body) {
  return POST(new Request("http://localhost/api/recommend", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

test("movie, music and both execute real searches and return grounded recommendations", async (t) => {
  for (const recommendationType of ["movie", "music", "both"]) {
    await t.test(recommendationType, async (t) => {
      const names = recommendationType === "movie" ? ["search_movies"]
        : recommendationType === "music" ? ["search_music"] : ["search_movies", "search_music"];
      const requests = mockOpenAI(t, [names.map((name) => call(name)), [final(
        names.includes("search_movies") ? [{ id: "movie-001", reason: "따뜻한 이야기입니다." }] : [],
        names.includes("search_music") ? [{ id: "music-001", reason: "차분한 곡입니다." }] : [],
      )]]);
      const response = await send({ recommendationType, maxRuntime: 85 });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(result.toolCalls.map((item) => item.name), names);
      for (const trace of result.toolCalls) {
        assert.ok(trace.result.length > 0);
        if (trace.name === "search_movies") assert.ok(trace.result.every((item) => item.runtimeMinutes <= 85));
      }
      assert.equal(result.recommendations.movies.length, names.includes("search_movies") ? 1 : 0);
      assert.equal(result.recommendations.music.length, names.includes("search_music") ? 1 : 0);
      for (const item of [...result.recommendations.movies, ...result.recommendations.music]) {
        const { reason, ...record } = item;
        assert.ok(reason);
        assert.deepEqual(record, result.toolCalls.flatMap((trace) => trace.result).find((row) => row.id === item.id));
      }
      assert.deepEqual(requests[0].tools.map((tool) => tool.name), names);
      assert.equal(requests[0].tool_choice, "required");
      assert.equal(requests[0].store, false);
      const toolOutputs = requests[1].input.filter((item) => item.type === "function_call_output");
      assert.deepEqual(toolOutputs.map((item) => JSON.parse(item.output)), result.toolCalls.map((trace) => trace.result));
    });
  }
});

test("both calls the missing search if the model initially selects only one", async (t) => {
  const requests = mockOpenAI(t, [[call("search_music")], [call("search_movies")], [final(
    [{ id: "movie-001", reason: "위로가 됩니다." }], [{ id: "music-001", reason: "따뜻합니다." }],
  )]]);
  const response = await send({ recommendationType: "both" });
  assert.equal(response.status, 200);
  assert.deepEqual(requests[1].tools.map((tool) => tool.name), ["search_movies"]);
});

test("empty search results produce empty recommendations", async (t) => {
  mockOpenAI(t, [[call("search_movies", { genre: "없는 장르" })], [final()]]);
  const response = await send({ recommendationType: "movie" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.toolCalls[0].result, []);
  assert.deepEqual(result.recommendations, { movies: [], music: [] });
});

test("rejects fabricated IDs and real IDs absent from search results", async (t) => {
  for (const id of ["movie-invented", "movie-003"]) {
    await t.test(id, async (t) => {
      mockOpenAI(t, [[call("search_movies")], [final([{ id, reason: "이유" }])]]);
      assert.equal((await send({ recommendationType: "movie", maxRuntime: 85 })).status, 502);
    });
  }
});

test("rejects unrequested functions and invalid tool arguments", async (t) => {
  for (const output of [call("search_music"), call("delete_files"), call("search_movies", { maxRuntimeMinutes: "90" })]) {
    await t.test(output.name + output.arguments, async (t) => {
      mockOpenAI(t, [[output]]);
      assert.equal((await send({ recommendationType: "movie" })).status, 502);
    });
  }
});

test("missing key returns safe configuration error", async (t) => {
  mockOpenAI(t, []);
  delete process.env.OPENAI_API_KEY;
  const response = await send({ recommendationType: "movie" });
  assert.equal(response.status, 503);
});

test("upstream failures never expose keys or raw errors", async (t) => {
  mockOpenAI(t, [new Response("secret upstream details", { status: 401 })]);
  const response = await send({ recommendationType: "movie" });
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.ok(!text.includes("secret upstream details"));
  assert.ok(!text.includes("test-key-never-sent"));
});

test("rejects invalid preference values", async () => {
  for (const patch of [
    { mood: 1 }, { genre: [] }, { favorite: {} }, { request: false },
    { recommendationType: "unknown" }, { maxRuntime: "90" },
    { maxRuntime: 0 }, { maxRuntime: 1.5 },
  ]) {
    assert.equal((await send({ ...preferences, ...patch })).status, 400);
  }
});

test("rejects missing recommendation type and non-object bodies", async () => {
  for (const body of [{}, null, [], "hello"]) {
    assert.equal((await send(body)).status, 400);
  }
});

test("rejects malformed JSON without echoing request data", async () => {
  const response = await POST(new Request("http://localhost/api/recommend", {
    method: "POST", body: "{invalid",
  }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "올바른 JSON 요청이 필요합니다." });
});
