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
- 마이크 소리 크기 기능은 HTTPS(터널 주소)나 localhost에서만 마이크 권한을 받을 수 있다.
