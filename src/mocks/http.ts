// 목업 요청/응답 타입과 에러 헬퍼 (adapter ↔ handlers 순환 import 방지용)

export type MockRequest = {
  method: string;
  path: string;
  params: Record<string, any>;
  body: any;
  match: RegExpMatchArray;
};

export type MockResult = { status?: number; data?: unknown };

type MockHttpError = Error & { __mockHttp: true; status: number; code: string };

/** 핸들러에서 throw 하면 실제 서버가 에러를 준 것처럼 axios 에러로 변환된다 */
export const httpError = (status: number, code: string, message: string): MockHttpError =>
  Object.assign(new Error(message), { __mockHttp: true as const, status, code });

export const isHttpError = (e: unknown): e is MockHttpError =>
  typeof e === 'object' && e !== null && (e as MockHttpError).__mockHttp === true;
