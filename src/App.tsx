import './App.css'
import Nav from './components/layout/Nav'
import { Route, Routes } from 'react-router-dom'
import NotFound from './pages/NotFoundPage'
import HomePage from './pages/HomePage'
import ReportPage from './pages/ReportPage'
import ChatPage from './pages/ChatPage'
import FestivalListPage from './pages/FestivalListPage'
import RoomListPage from './pages/RoomListPage'
import ConfirmModal from './components/common/ConfirmModal'
import { useConfirmStore } from './stores/useConfirmStore'
import CreateRoomPage from './pages/CreateRoomPage'
import MyChatPage from './pages/MyChatPage'
import { useEffect, useState } from 'react'
import SearchPage from './pages/SearchPage'
import MyPage from './pages/MyPage'
import KakaoLoginModal from './components/main/KakaoLoginModal'
import useLoginStore from './stores/useLoginStore'
import KakaoRedirectPage from './pages/KakaoRedirectPage'
import useLocationStore from './stores/useLocationStore'
import ComponentTestPage from './pages/ComponentTestPage'
import { USE_MOCK, MOCK_LOCATION } from './mocks'

function App() {
  //확인 모달용
  const { isOpen, title, message, confirmText, cancelText,
    onConfirm, onCancel, closeConfirm, variant, } = useConfirmStore();

  const { isLoginModalOpen, closeLoginModal } = useLoginStore();

  const { setIsAllowed, setIsDenied, setLocation } = useLocationStore();


  useEffect(() => {
    // 목업: 위치 권한 허용 + 노들섬 위치로 고정 (브라우저 위치 팝업 없이 채팅/방 생성 가능)
    if (USE_MOCK) {
      setIsAllowed();
      setLocation(MOCK_LOCATION.lat, MOCK_LOCATION.lon);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsAllowed();
        const { latitude, longitude } = pos.coords;
        //TODO 추후 위치 변경
        // setLocation(latitude, longitude);

        // 노들
        setLocation(37.5179669, 126.957047)

        // 한강역사탐방
        // setLocation(37.5263997727, 126.9336095794)

        // 청춘마이크 수도강원권 
        // setLocation(37.5119526047, 126.9980013443)

        // 서울 무용제
        // setLocation(37.5812640855, 127.0029878163)

        // 구리
        // setLocation(37.5825191614, 127.1386448674)

        // 퓨처그라운드 (FUTUREGROUND)
        // setLocation(37.5621960337, 126.8015844987)

        // 종로 어디나 스테이지
        // setLocation(37.5720618985, 126.9763210635)

        // 2025 문화가 흐르는 서울광장
        // setLocation(37.5655015943, 126.9787960237)

        // 쏙쏙들이페스티벌
        // setLocation(37.7833378215, 126.6946991484)

        // 광무대 목요풍류
        // setLocation(37.5708709408, 127.008107089)

        // APAP 작품투어
        // setLocation(37.4195037091, 126.9256299791)

        // 서울조각페스티벌
        // setLocation(37.5662570431, 126.9777210995)

        // 서울 왕궁수문장 교대의식
        // setLocation(37.5651071556, 126.9765906796)

        // 남산봉수의식 등 전통문화행사
        // setLocation(37.5698206245, 126.9836898995)

        // DDP 건축투어
        // setLocation(37.566107632, 127.0095709797)

        // 남동 빛의 거리
        // setLocation(37.4415949966, 126.7360188509)

        // 페인터즈
        // setLocation(37.5681316804, 126.9696495605)

        // 2025 우리쌀 우리술 K-라이스페스타
        // setLocation(37.6689881691, 126.7458171427)

        //latitude: lat ?? 37.5179669,
        //longitude: lon ?? 126.957047,
      },
      (err) => {
        //로그인 안했으면 고정값
        setLocation(37.5701342, 126.9772235);
        console.log(err);
      }
    );

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        status.onchange = () => {
          console.log('권한 변경:', status.state);
          if (status.state === 'granted') {
            navigator.geolocation.getCurrentPosition((pos) => {
              setIsAllowed();
              setLocation(pos.coords.latitude, pos.coords.longitude);
            });
          }
          else {
            setIsDenied();
          }
        };
      });
    }
  }, []);


  return (
    <div className='flex flex-col h-dvh w-full min-w-[360px] max-w-[480px] sm:w-100 mx-auto relative overflow-hidden'
      translate='no'>
      <div className='flex-1 relative pb-18'>
        <div className='absolute inset-0'>
          <div className='flex flex-col w-full h-full '>
            <Routes>
              <Route path='/' element={<HomePage />} />
              <Route path='/festival-list' element={<FestivalListPage />} />
              <Route path='/room-list/:festivalId' element={<RoomListPage />} />
              <Route path='/create-room/:festivalId' element={<CreateRoomPage />} />
              <Route path='/my-chat' element={<MyChatPage />} />
              <Route path='/mypage' element={<MyPage />} />
              <Route path='/chat/:roomId' element={<ChatPage />} />
              <Route path='/search' element={<SearchPage />} />
              <Route path='/kakao-redirect' element={<KakaoRedirectPage />} />
              <Route path='*' element={<NotFound />} />
              <Route path='test' element={<ComponentTestPage />} /> //TODO 추후 삭제
              {/*<Route path='/report' element={<ReportPage />} /> //제보
            <Route path='echo' element={<EchoTest />} />
            <Route path='/logout' element={<KakaoLogout />} />
            <Route path='/quit' element={<Quit />} /> */}
            </Routes>
          </div>

        </div>
      </div>
      <ConfirmModal
        isOpen={isOpen}
        variant={variant}
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        onConfirm={onConfirm}
        onCancel={onCancel}
        onClose={closeConfirm}
      />

      <KakaoLoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal} />
    </div>
  )
}

export default App
