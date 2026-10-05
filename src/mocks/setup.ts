// ⚠️ 이 파일은 src/main.tsx 의 "맨 첫 번째 import" 여야 합니다.
// api/axios.ts, api/apiClient.ts 가 axios.create() 를 실행하기 전에
// axios 기본 adapter 를 가짜 응답기로 바꿔치기해야 하기 때문입니다.

import axios from 'axios';
import useAuthStore from '@/stores/useAuthStore';
import { mockAdapter } from './adapter';
import { MOCK_TOKEN } from './auth';
import { MOCK_AUTOLOGIN, USE_MOCK } from './config';

if (USE_MOCK) {
  axios.defaults.adapter = mockAdapter;

  const { accessToken, setAccessToken, logout } = useAuthStore.getState();

  // 예전에 진짜 서버로 로그인해서 localStorage 에 남은 토큰은 목업과 안 맞으므로 비운다
  if (accessToken && accessToken !== MOCK_TOKEN) logout();

  if (MOCK_AUTOLOGIN) setAccessToken(MOCK_TOKEN);

  console.info(
    '%c[mock] 목업 모드로 실행 중 - 서버/DB/WebSocket 없이 가짜 데이터로 동작합니다.',
    'color:#2563eb;font-weight:bold'
  );
}
