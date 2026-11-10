"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { recommend, RecommendationRequest } from "../lib/recommend";

type RecommendationResponse = Awaited<ReturnType<typeof recommend>>;
type Recommendation = RecommendationResponse["recommendations"]["movies"][number]
  | RecommendationResponse["recommendations"]["music"][number];
const filterLabels: Record<string, string> = {
  genre: "장르", mood: "분위기", maxRuntimeMinutes: "최대 상영시간", energyLevel: "에너지 수준",
};

function RecommendationCard({ item }: { item: Recommendation }) {
  return (
    <article className="recommendation-card">
      <h4>{item.title}</h4>
      <p className="card-meta">{item.genres.join(" · ")}</p>
      <p className="card-meta">
        {"runtimeMinutes" in item ? `상영시간 ${item.runtimeMinutes}분` : `아티스트 ${item.artist}`}
      </p>
      <p className="card-reason"><strong>추천 이유</strong>{item.reason}</p>
    </article>
  );
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [requestedType, setRequestedType] = useState<RecommendationRequest["recommendationType"]>("both");
  const inFlight = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    const recommendationType = form.get("recommendationType") as RecommendationRequest["recommendationType"];
    const runtime = String(form.get("maxRuntime") ?? "").trim();
    const preferences: RecommendationRequest = {
      mood: String(form.get("mood") ?? "").trim(),
      genre: String(form.get("genre") ?? "").trim(),
      favorite: String(form.get("favorite") ?? "").trim(),
      recommendationType,
      ...(runtime ? { maxRuntime: Number(runtime) } : {}),
      request: String(form.get("request") ?? "").trim(),
    };
    inFlight.current = true;
    setIsLoading(true);
    setError("");
    setResult(null);
    setRequestedType(recommendationType);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
        signal: AbortSignal.timeout(200_000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(`추천을 불러오지 못했습니다. ${typeof data?.error === "string" ? data.error : "잠시 후 다시 시도해 주세요."}`);
        return;
      }
      if (!Array.isArray(data?.recommendations?.movies) || !Array.isArray(data?.recommendations?.music) || !Array.isArray(data?.toolCalls)) {
        throw new Error("Invalid recommendation response");
      }
      setResult(data);
    } catch {
      setError("추천을 불러오지 못했습니다. 네트워크 연결을 확인하고 잠시 후 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  const statusMessage = isLoading ? "추천을 준비하고 있습니다. 잠시만 기다려 주세요."
    : result ? (result.recommendations.movies.length + result.recommendations.music.length > 0
      ? "추천이 완료되었습니다." : "조건에 맞는 추천 작품이 없습니다.")
      : error ? "" : "취향을 입력하고 추천받기를 눌러 주세요.";

  return (
    <main>
      <header className="page-header">
        <h1>AI 음악·영화 취향 큐레이터</h1>
        <p>준비 중인 실습 앱입니다</p>
        <p>실습용 가상 데이터</p>
      </header>

      <section className="panel" aria-labelledby="preferences-heading">
        <h2 id="preferences-heading">나의 취향</h2>
        <form onSubmit={handleSubmit} aria-busy={isLoading}>
          <fieldset className="preferences-fields" disabled={isLoading}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="mood">기분</label>
              <input id="mood" name="mood" type="text" placeholder="지금 어떤 기분인가요?" />
            </div>
            <div className="field">
              <label htmlFor="genre">선호 장르</label>
              <input id="genre" name="genre" type="text" placeholder="예: 코미디, 재즈" />
            </div>
            <div className="field full-width">
              <label htmlFor="favorite">좋아하는 영화 또는 가수</label>
              <input id="favorite" name="favorite" type="text" placeholder="좋아하는 영화 제목이나 가수를 적어 주세요" />
            </div>
            <fieldset className="field">
              <legend>추천 유형</legend>
              <div className="radio-group">
                <label><input type="radio" name="recommendationType" value="movie" /> 영화</label>
                <label><input type="radio" name="recommendationType" value="music" /> 음악</label>
                <label><input type="radio" name="recommendationType" value="both" defaultChecked /> 둘 다</label>
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="max-runtime">영화 최대 상영시간 (분)</label>
              <input id="max-runtime" name="maxRuntime" type="number" min="1" step="1" placeholder="예: 120" />
            </div>
            <div className="field full-width">
              <label htmlFor="request">자유 요청 문장</label>
              <textarea id="request" name="request" rows={4} placeholder="원하는 분위기나 요청을 자유롭게 적어 주세요" />
            </div>
          </div>
          </fieldset>
          <button type="submit" disabled={isLoading} aria-describedby="button-note">
            {isLoading ? "추천 중…" : "추천받기"}
          </button>
          <p id="button-note" className="help-text" role="status" aria-atomic="true">{statusMessage}</p>
          {error && <p className="error-message" role="alert">{error}</p>}
        </form>
      </section>

      <section className="panel" aria-labelledby="results-heading">
        <h2 id="results-heading">추천 결과</h2>
        <div className="results" role="region" aria-label="추천 결과 내용" aria-busy={isLoading}>
          {!result && <p className="empty-message">{isLoading ? "영화와 음악 취향을 살펴보고 있습니다." : error ? "추천 결과를 가져오지 못했습니다." : "추천받기를 누르면 결과가 여기에 표시됩니다."}</p>}
          {result && requestedType !== "music" && (
            <section className="result-group" aria-labelledby="movie-results-heading">
              <h3 id="movie-results-heading">영화 추천</h3>
              {result.recommendations.movies.length > 0
                ? <div className="card-grid">{result.recommendations.movies.map((item) => <RecommendationCard key={item.id} item={item} />)}</div>
                : <p className="empty-message">조건에 맞는 영화가 없습니다. 장르·분위기·최대 상영시간 조건을 조정해 주세요.</p>}
            </section>
          )}
          {result && requestedType !== "movie" && (
            <section className="result-group" aria-labelledby="music-results-heading">
              <h3 id="music-results-heading">음악 추천</h3>
              {result.recommendations.music.length > 0
                ? <div className="card-grid">{result.recommendations.music.map((item) => <RecommendationCard key={item.id} item={item} />)}</div>
                : <p className="empty-message">조건에 맞는 음악이 없습니다. 장르·분위기 조건을 조정해 주세요.</p>}
            </section>
          )}
        </div>
      </section>

      <section className="panel" role="region" aria-labelledby="agent-heading">
        <h2 id="agent-heading">AI Agent 실행 기록</h2>
        {!result && <p className="empty-message">{isLoading ? "추천이 완료되면 실행 기록을 표시합니다." : error ? "실행 기록을 가져오지 못했습니다." : "아직 실행된 검색 함수가 없습니다."}</p>}
        {result && result.toolCalls.length === 0 && <p className="empty-message">실행된 검색 함수가 없습니다.</p>}
        {result && result.toolCalls.length > 0 && (
          <ol className="agent-history">
            {result.toolCalls.map((trace, index) => (
              <li key={`${trace.name}-${index}`}>
                <p><strong>{trace.name === "search_movies" ? "영화 검색" : "음악 검색"}</strong> <code>{trace.name}</code></p>
                <p className="trace-filters">검색 조건: {Object.entries(trace.arguments).length === 0 ? "제한 없음" : Object.entries(trace.arguments).map(([key, value]) => {
                  const label = filterLabels[key] ?? key;
                  return `${label}: ${value}${key === "maxRuntimeMinutes" ? "분" : ""}`;
                }).join(" · ")}</p>
                <details>
                  <summary>검색 결과 {trace.result.length}개</summary>
                  {trace.result.length === 0 ? <p>조건에 맞는 검색 결과가 없습니다.</p> : (
                    <ul>{trace.result.map((item) => <li key={item.id}>{item.title} <span className="record-id">({item.id})</span></li>)}</ul>
                  )}
                </details>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
