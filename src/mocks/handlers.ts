// URL 별 가짜 응답. 새 API 가 생기면 routes 배열에 한 줄 추가하면 됩니다.
//   route('get', /^\/api\/v1\/something$/, ({ params }) => ({ data: ... }))

import { httpError } from './http';
import type { MockRequest, MockResult } from './http';
import { busEmit } from './bus';
import * as db from './db';
import { MOCK_TOKEN } from './auth';

type Route = {
  method: string;
  pattern: RegExp;
  handler: (req: MockRequest) => MockResult | void;
};

const route = (method: string, pattern: RegExp, handler: Route['handler']): Route => ({
  method,
  pattern,
  handler,
});

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? n : fallback;
};
const truthy = (v: unknown) => v === true || v === 'true';

function paginate<T>(items: T[], page: number, pageSize: number) {
  return {
    content: items.slice((page - 1) * pageSize, page * pageSize),
    currentPage: page,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    totalElements: items.length,
    blockSize: 5,
  };
}

const includes = (text: string, keyword: string) => text.toLowerCase().includes(keyword.toLowerCase());

function filterFestivals(params: Record<string, any>) {
  let list = db.getLiveFestivals();

  if (params.region) list = list.filter((f) => f.region === params.region);
  if (params.keyword) list = list.filter((f) => includes(f.title, params.keyword) || includes(f.addr1, params.keyword));

  if (params.status === 'UPCOMING') {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    list = list.filter((f) => f.eventStartDate > todayStr);
  }

  // 위치 기반 조회 (radius 는 km 로 해석)
  if (truthy(params.ps) && params.lat != null && params.lon != null) {
    const radius = num(params.radius, 100);
    list = list.filter(
      (f) => db.distanceKm(num(params.lat, 0), num(params.lon, 0), f.lat, f.lon) <= radius
    );
  }

  list = [...list].sort((a, b) =>
    params.order === 'DATE_ASC'
      ? a.eventStartDate.localeCompare(b.eventStartDate)
      : b.eventStartDate.localeCompare(a.eventStartDate)
  );
  return list;
}

export const routes: Route[] = [
  /* ───────────── 축제 ───────────── */
  // 주의: /festivals/count 가 /festivals/:id 보다 먼저 와야 함
  route('get', /^\/api\/v1\/festivals\/count$/, ({ params }) => ({
    data: { count: filterFestivals({ region: params.region }).length },
  })),

  route('get', /^\/api\/v1\/festivals$/, ({ params }) => {
    const list = filterFestivals(params).map(db.festivalView);
    return { data: paginate(list, num(params.page, 1), num(params.pageSize, 10)) };
  }),

  route('get', /^\/api\/v1\/festivals\/([^/]+)$/, ({ match }) => {
    const f = db.getFestivalById(Number(match[1]));
    if (!f) throw httpError(404, 'NOT_FOUND', '해당 축제를 찾을 수 없습니다.');
    return { data: db.festivalView(f) };
  }),

  route('get', /^\/api\/v1\/festivals\/([^/]+)\/chat-rooms$/, ({ match, params }) => {
    let list = db.getRoomsOfFestival(Number(match[1])).map(db.roomView);
    if (params.keyword) list = list.filter((r) => includes(r.title, params.keyword));
    return { data: paginate(list, num(params.page, 1), num(params.pageSize, 30)) };
  }),

  route('post', /^\/api\/v1\/festivals\/([^/]+)\/chat-rooms$/, ({ match, body }) => {
    const festival = db.getFestivalById(Number(match[1]));
    if (!festival) throw httpError(404, 'NOT_FOUND', '해당 축제를 찾을 수 없습니다.');

    // 실제 서버와 같은 반경 검사 (1km)
    const dist = db.distanceKm(num(body?.lat, 0), num(body?.lon, 0), festival.lat, festival.lon);
    if (dist > 1) throw httpError(400, 'BAD_REQUEST', '채팅방 개설 반경(1.0km)을 벗어났습니다.');

    const created = db.createRoom(festival.festivalId, String(body?.title ?? '').trim() || '새 채팅방');
    return { status: 201, data: db.roomView(created) };
  }),

  /* ───────────── 채팅방 ───────────── */
  route('get', /^\/api\/v1\/chat-rooms\/my-rooms$/, ({ params }) => {
    const list = db.getMyRooms();
    return { data: paginate(list, num(params.page, 1), num(params.pageSize, 90)) };
  }),

  route('post', /^\/api\/v1\/chat-rooms\/([^/]+)\/join$/, ({ match }) => {
    const id = match[1];
    const room = db.getRoomRecord(id);
    if (!room) throw httpError(404, 'NOT_FOUND', '채팅방을 찾을 수 없습니다.');
    if (db.isJoined(id)) throw httpError(409, 'CONFLICT', '이미 채팅방에 입장되어 있습니다.');
    if (room.participantCount >= db.MAX_PARTICIPANTS) {
      throw httpError(409, 'CONFLICT', `채팅방 최대 정원(${db.MAX_PARTICIPANTS}명)을 초과했습니다.`);
    }
    db.joinRoom(id);
    return { data: db.roomView(room) };
  }),

  route('post', /^\/api\/v1\/chat-rooms\/([^/]+)\/leave$/, ({ match }) => {
    db.leaveRoom(match[1]);
    return { data: null };
  }),

  route('get', /^\/api\/v1\/chat-rooms\/([^/]+)\/messages$/, ({ match, params }) => ({
    data: db.getMessagePage(match[1], params.before),
  })),

  route('post', /^\/api\/v1\/messages\/([^/]+)\/like$/, ({ match }) => {
    const result = db.toggleLike(match[1]);
    if (!result) throw httpError(404, 'NOT_FOUND', '메시지를 찾을 수 없습니다.');
    // 실제 서버처럼 WebSocket 으로 좋아요 이벤트를 방송
    busEmit(`/sub/chat-rooms/${result.roomId}`, {
      messageId: result.messageId,
      liked: result.liked,
      likeCount: result.likeCount,
    });
    return { data: { liked: result.liked, likeCount: result.likeCount } };
  }),

  /* ───────────── 검색 ───────────── */
  route('get', /^\/api\/v1\/search\/festivals$/, ({ params }) => {
    const keyword = String(params.keyword ?? '');
    const content = db.getLiveFestivals().filter((f) => includes(f.title, keyword)).map(db.festivalView);
    return { data: { content } };
  }),

  route('get', /^\/api\/v1\/search\/chat-rooms$/, ({ params }) => {
    const keyword = String(params.keyword ?? '');
    const content = db
      .getAllRooms()
      .map(db.roomView)
      .filter((r) => includes(r.title, keyword) || includes(r.festivalTitle, keyword));
    return { data: { content } };
  }),

  route('get', /^\/api\/v1\/search$/, ({ params }) => {
    const keyword = String(params.keyword ?? '');
    const festivals = db.getLiveFestivals().filter((f) => includes(f.title, keyword)).map(db.festivalView);
    const chatRooms = db
      .getAllRooms()
      .map(db.roomView)
      .filter((r) => includes(r.title, keyword) || includes(r.festivalTitle, keyword));
    return {
      data: {
        festivals: { totalCount: festivals.length, data: festivals },
        chatRooms: { totalCount: chatRooms.length, data: chatRooms },
      },
    };
  }),

  /* ───────────── 유저 / 인증 ───────────── */
  route('get', /^\/api\/v1\/user\/me$/, () => ({ data: db.getUser() })),
  route('post', /^\/api\/v1\/user\/me\/quit$/, () => ({ status: 204 })),
  route('post', /^\/api\/auth\/logout$/, () => ({ status: 204 })),
  route('post', /^\/api\/auth\/refresh$/, () => ({ data: { accessToken: MOCK_TOKEN } })),
  route('get', /^\/api\/auth\/kakao\/callback$/, () => ({ data: { accessToken: MOCK_TOKEN } })),
];
