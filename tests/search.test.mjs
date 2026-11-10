import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { search_movies, search_music } from "../lib/search.ts";

const movies = JSON.parse(readFileSync(new URL("../data/movies.json", import.meta.url), "utf8"));
const music = JSON.parse(readFileSync(new URL("../data/music.json", import.meta.url), "utf8"));

test("no filters return all original records", () => {
  assert.deepEqual(search_movies(), movies);
  assert.deepEqual(search_music(), music);
});

test("movies combine genre, mood and inclusive maximum runtime", () => {
  assert.deepEqual(search_movies({ genre: "드라마", mood: "따뜻함", maxRuntimeMinutes: 85 }), [movies[0]]);
  assert.deepEqual(search_movies({ genre: "드라마", mood: "따뜻함", maxRuntimeMinutes: 84 }), []);
});

test("each movie filter also works independently", () => {
  assert.deepEqual(search_movies({ genre: "공포" }).map((item) => item.id), ["movie-028", "movie-029", "movie-030"]);
  assert.equal(search_movies({ mood: "설렘" }).length, 2);
  assert.equal(search_movies({ maxRuntimeMinutes: 90 }).length, 10);
});

test("music combines genre, mood and exact energy level", () => {
  assert.deepEqual(search_music({ genre: "팝", mood: "따뜻함", energyLevel: 2 }), [music[0]]);
  assert.deepEqual(search_music({ genre: "팝", mood: "따뜻함", energyLevel: 3 }), []);
});

test("each music filter also works independently", () => {
  assert.deepEqual(search_music({ genre: "재즈" }).map((item) => item.id), ["music-007", "music-008", "music-009"]);
  assert.equal(search_music({ mood: "슬픔" }).length, 3);
  assert.equal(search_music({ energyLevel: 5 }).length, 6);
});

test("unmatched filters return empty arrays without fallback", () => {
  assert.deepEqual(search_movies({ genre: "없는 장르" }), []);
  assert.deepEqual(search_music({ mood: "없는 분위기" }), []);
  assert.deepEqual(search_movies({ maxRuntimeMinutes: 0 }), []);
  assert.deepEqual(search_music({ energyLevel: 0 }), []);
});

test("returned records preserve all original fields and do not mutate source data", () => {
  const movie = search_movies({ maxRuntimeMinutes: 85 })[0];
  movie.title = "변경";
  movie.genres.push("변경");
  const song = search_music({ energyLevel: 2 })[0];
  song.moodTags.push("변경");
  assert.deepEqual(search_movies(), movies);
  assert.deepEqual(search_music(), music);
});
