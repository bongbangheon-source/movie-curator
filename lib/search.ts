import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Movie {
  id: string;
  title: string;
  genres: string[];
  runtimeMinutes: number;
  moodTags: string[];
  description: string;
}

export interface Music {
  id: string;
  title: string;
  artist: string;
  genres: string[];
  moodTags: string[];
  energyLevel: number;
}

export interface MovieSearchFilters {
  genre?: string;
  mood?: string;
  maxRuntimeMinutes?: number;
}

export interface MusicSearchFilters {
  genre?: string;
  mood?: string;
  energyLevel?: number;
}

// Node.js 서버 전용 모듈입니다. 프로젝트 루트에서 실행하며 클라이언트에서는 가져오지 않습니다.
const movies: Movie[] = JSON.parse(
  readFileSync(join(process.cwd(), "data", "movies.json"), "utf8"),
);
const music: Music[] = JSON.parse(
  readFileSync(join(process.cwd(), "data", "music.json"), "utf8"),
);

/** 지정한 모든 조건을 만족하는 영화를 원본 순서와 정보 그대로 반환합니다. */
export function search_movies(filters: MovieSearchFilters = {}): Movie[] {
  return structuredClone(movies.filter((movie) =>
    (filters.genre === undefined || movie.genres.includes(filters.genre)) &&
    (filters.mood === undefined || movie.moodTags.includes(filters.mood)) &&
    (filters.maxRuntimeMinutes === undefined || movie.runtimeMinutes <= filters.maxRuntimeMinutes),
  ));
}

/** 지정한 모든 조건을 만족하는 음악을 원본 순서와 정보 그대로 반환합니다. */
export function search_music(filters: MusicSearchFilters = {}): Music[] {
  return structuredClone(music.filter((song) =>
    (filters.genre === undefined || song.genres.includes(filters.genre)) &&
    (filters.mood === undefined || song.moodTags.includes(filters.mood)) &&
    (filters.energyLevel === undefined || song.energyLevel === filters.energyLevel),
  ));
}
