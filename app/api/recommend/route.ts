import { recommend, RecommendationError } from "../../../lib/recommend.ts";
import type { RecommendationRequest } from "../../../lib/recommend.ts";

export const runtime = "nodejs";

function isRecommendationRequest(value: unknown): value is RecommendationRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return (
    ["movie", "music", "both"].includes(body.recommendationType as string) &&
    ["mood", "genre", "favorite", "request"].every(
      (key) => body[key] === undefined || typeof body[key] === "string",
    ) &&
    (body.maxRuntime === undefined ||
      (typeof body.maxRuntime === "number" &&
        Number.isSafeInteger(body.maxRuntime) && body.maxRuntime > 0))
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "올바른 JSON 요청이 필요합니다." }, { status: 400 });
  }

  if (!isRecommendationRequest(body)) {
    return Response.json({ error: "취향 정보의 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // 정의된 취향 정보만 AI에 전달하고 알 수 없는 필드는 제외합니다.
  const { mood, genre, favorite, recommendationType, maxRuntime, request: freeRequest } = body;
  try {
    const result = await recommend({ mood, genre, favorite, recommendationType, maxRuntime, request: freeRequest });
    return Response.json(result);
  } catch (error) {
    if (error instanceof RecommendationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "추천 처리 중 오류가 발생했습니다. 잠시 후 다시 요청해 주세요." }, { status: 502 });
  }
}
