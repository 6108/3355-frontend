import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MOCK_LATENCY } from './config';
import { httpError, isHttpError } from './http';
import { routes } from './handlers';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const parseBody = (data: unknown) => {
  if (typeof data !== 'string' || !data) return data ?? null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const getPath = (config: InternalAxiosRequestConfig) => {
  // 상대경로('/api/..')든 절대경로('https://api../..')든 pathname 만 꺼낸다
  try {
    return new URL(config.url ?? '', 'http://mock.local').pathname;
  } catch {
    return config.url ?? '';
  }
};

const buildResponse = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown
): AxiosResponse => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: {},
  config,
  request: {},
});

export const mockAdapter: AxiosAdapter = async (config) => {
  await sleep(MOCK_LATENCY);

  const method = (config.method ?? 'get').toLowerCase();
  const path = getPath(config);

  try {
    const route = routes.find((r) => r.method === method && r.pattern.test(path));
    if (!route) {
      throw httpError(404, 'MOCK_NOT_FOUND', `[mock] 핸들러가 없는 요청: ${method.toUpperCase()} ${path}`);
    }

    const result = route.handler({
      method,
      path,
      params: { ...(config.params ?? {}) },
      body: parseBody(config.data),
      match: path.match(route.pattern)!,
    });

    const status = result?.status ?? 200;
    // 실제 서버 응답 형태: { data: ... }  (프론트는 res.data.data 로 꺼내 씀)
    const data = status === 204 ? '' : { success: true, data: result?.data ?? null };
    console.debug(`[mock] ${method.toUpperCase()} ${path}`, { params: config.params, body: parseBody(config.data) }, '→', data);
    return buildResponse(config, status, data);
  } catch (e) {
    if (isHttpError(e)) {
      console.debug(`[mock] ${method.toUpperCase()} ${path} → ${e.status} ${e.message}`);
      const response = buildResponse(config, e.status, {
        success: false,
        error: { code: e.code, message: e.message },
      });
      throw new AxiosError(e.message, String(e.status), config, {}, response);
    }
    throw e;
  }
};
