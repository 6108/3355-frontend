// 목업 모드 설정값 모음
// .env.mock 에서 VITE_USE_MOCK=true 로 켭니다. (npm run dev:mock)

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/** 가짜 API 응답 지연(ms). 실제 서버 느낌을 내려면 100~300 정도 */
export const MOCK_LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY ?? 150);

/** true(기본)면 앱 시작 시 자동 로그인 상태. false면 카카오 로그인 모달 흐름을 직접 눌러볼 수 있음 */
export const MOCK_AUTOLOGIN = import.meta.env.VITE_MOCK_AUTOLOGIN !== 'false';

/** 채팅 WebSocket 연결 지연(ms). 첫 메시지 조회(HTTP)보다 늦게 연결되도록 HTTP 지연보다 크게 둘 것 */
export const MOCK_WS_DELAY = 400;

/** 내 채팅에 상대방 가짜 답장이 오게 할지 */
export const MOCK_BOT_REPLY = import.meta.env.VITE_MOCK_BOT_REPLY !== 'false';

/** 목업에서의 내 위치 (노들섬) - 이 근처 축제는 채팅/방 생성이 가능 */
export const MOCK_LOCATION = { lat: 37.5179669, lon: 126.957047 };

/** 채팅방 최대 정원 */
export const MOCK_MAX_PARTICIPANTS = 100;

export const MOCK_USER_ID = 'mock-user-1';
export const MOCK_USER_NICKNAME = '목업유저';
