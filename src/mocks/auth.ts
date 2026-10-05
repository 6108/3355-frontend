import useAuthStore from '@/stores/useAuthStore';
import { MOCK_USER_ID } from './config';

const b64url = (obj: object) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * ChatPage / getUserId 가 jwtDecode 로 토큰을 파싱하므로
 * 형식만 맞는 가짜 JWT 를 만들어 둔다. (sub = 유저 id, auth = 권한)
 */
export const MOCK_TOKEN = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({ sub: MOCK_USER_ID, auth: 'ROLE_USER', exp: 4102444800 }), // 2100-01-01
  'mock-signature',
].join('.');

/** 카카오 로그인 대신 호출: 가짜 토큰을 저장해 로그인 상태로 만든다 */
export const mockLogin = () => {
  useAuthStore.getState().setAccessToken(MOCK_TOKEN);
};
