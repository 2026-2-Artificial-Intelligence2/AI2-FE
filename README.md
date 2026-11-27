# 부장님 몰래 · 프론트엔드

"부장님 몰래" 게임 화면(Vite + React + three.js)이다. 게임 서버는 [AI2-BE](https://github.com/2026-2-Artificial-Intelligence2/AI2-BE)에 있고, 서버와 주고받는 명령·메시지는 그 저장소의 `PROTOCOL.md`에 있다.

## 준비

```bash
npm install
```

## 내 컴퓨터에서 실행

백엔드(AI2-BE 폴더에서 `./gradlew bootRun`, 기본 8080)를 먼저 띄운 뒤:

```bash
npm run dev
```

`http://127.0.0.1:5173`으로 들어간다. 화면은 자기 주소의 `/ws/lobby`로 접속하고, Vite가 그 연결을 백엔드로 넘겨준다(`vite.config.js`의 proxy). 백엔드가 8080이 아니면 주소를 알려 준다.

```bash
OFFICE_STOCK_BACKEND=http://127.0.0.1:5177 npm run dev
```

## 친구들과 인터넷 너머로 플레이 (터널)

내 컴퓨터를 켜 둔 채 Cloudflare 터널로 **이 화면 주소 하나만** 연다. 게임 연결은 화면 서버가 백엔드로 넘겨주므로 백엔드를 따로 열 필요가 없다. 터미널 세 개에서 차례로 실행한다.

1. 백엔드 (AI2-BE 폴더)

   ```bash
   ./gradlew bootRun
   ```

2. 화면 빌드와 실행 (이 폴더). 개발 서버도 되지만 터널 너머에서는 빌드한 화면이 훨씬 빨리 뜬다.

   ```bash
   npm run build && npm run preview
   ```

3. 터널 (`cloudflared` 설치 필요, 계정 없이 된다). 나온 `https://….trycloudflare.com` 주소를 친구들에게 보낸다. 개발 서버로 열었다면 4173 대신 5173을 쓴다.

   ```bash
   cloudflared tunnel --url http://localhost:4173
   ```

이를 위해 설정해 둔 것:
- `vite.config.js`: 개발 서버와 preview 모두 `allowedHosts`에 `.trycloudflare.com`을 넣었다. Vite는 모르는 주소로 들어온 접속을 403으로 막는다.
- 백엔드 `game.allowed-origins`에 `https://*.trycloudflare.com`이 들어 있다. 그래서 터널 주소의 화면에서 온 게임 연결을 받아 준다.

알아 둘 것:
- 터널 주소는 켤 때마다 바뀐다. 터널을 닫거나 컴퓨터가 잠들면 접속이 끊긴다.
- 코드를 고치면 `npm run build`를 다시 하고 preview를 다시 띄워야 반영된다.
- 방에서 음성 참여를 누르면 브라우저에 마이크 권한을 요청한다. 이 기능은 HTTPS(터널 주소)나 localhost에서 사용할 수 있다.

## 화면과 코드 위치

| 화면 | 하는 일 | 코드 |
|---|---|---|
| 입장 | 누구로 출근할까요(로그인·회원가입·게스트), 함께 하기(방 만들기·초대 코드)/혼자 하기(1인 플레이 근무 시간), 명예의 전당 | `src/features/lobby/lobby.jsx`, `account-entry.jsx`, `leaderboard-panel.jsx` |
| 대기실 | 참가자 자리(회원/게스트 표시), 근무 시간, 시작, 사내 메신저 | `src/features/lobby/lobby.jsx` |
| 업무·주식 | 업무 창, 시세표(업종 표시)·차트·호가·주문, 업무 게이지, 비상 대출 | `src/features/work`, `src/features/market`, `src/features/loan` |
| 사무실 | 3D 사무실, 부장님 순찰·발소리·헛기침, 훈계 | `src/features/office`, `src/features/meeting`, `src/shared/audio` |
| 퇴근 | 순위, 매매 기록, 기록 저장 안내(회원/게스트) | `src/features/results` |
| 음성 | 머리글 "음성" 버튼과 설정 창(참여·음소거·나가기·참여자·사람별 음량) | `src/app/use-voice.js`, `src/app/voice-panel.jsx` |

- 서버와의 연결과 메시지 처리는 `src/app/use-game.js`에 모여 있다. 서버가 `hello`로 요청 ID를 알리면 명령마다 ID를 붙여, 오류를 보낸 명령의 버튼 밑에 정확히 보여 준다.
- 회원 로그인 열쇠는 localStorage(`officeStockLogin`), 방 재접속 열쇠는 sessionStorage(`officeStockSeat`)에 둔다.

## 음성 대화

- 같은 방에서 "음성" 버튼을 눌러 참여하면 브라우저끼리 WebRTC로 직접 연결된다. 서버는 연결 정보만 전달하고 목소리는 서버를 거치지 않는다. 1인 플레이에는 없다.
- 같은 와이파이, 서로 다른 와이파이끼리는 공개 STUN만으로 된다(실제 마이크로 확인). **휴대폰 데이터, 학교·회사 와이파이**처럼 직접 연결이 막힌 곳에서는 백엔드에 TURN(중계) 서버를 설정해야 한다(AI2-BE README "음성 대화와 TURN"). TURN은 배포할 때 붙이기로 했다.
- 휴대폰 브라우저가 소리 재생을 막으면 "음성 · 소리 켜기"가 뜨고, 화면을 한 번 누르면 들린다.
- 주소 끝에 `?relay=1`을 붙이면 중계로만 연결한다(TURN 설정 확인용). 개발 서버에서는 `window.officeVoice.join(stream)`으로 마이크 대신 다른 소리로 시험할 수 있다.
