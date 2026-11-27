# 소리 출처

## 배경음악

| 파일 | 곡 | 쓰는 곳 | 라이선스 |
|---|---|---|---|
| `music-lobby.m4a` | Silent Partner - Dog Park | 대기실 | 확인 필요(YouTube 오디오 보관함 곡으로 보임) |
| `office-music.m4a` | Office.mp3의 14:00~18:00 | 근무 중 | 확인 필요 |
| `music-result.m4a` | Kevin MacLeod - Hyperfun | 퇴근 뒤 | CC BY 4.0 (아래 표기 필수) |
| `music-loser.m4a` | Reed Mathis - Here Come The Raindrops | 퇴근 뒤, 가장 많이 잃은 사람 | 확인 필요(YouTube 오디오 보관함 곡으로 보임) |

"Hyperfun" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

게임 화면의 설정 창(음악 출처)에도 같은 표기를 보여 준다.

모든 음악 파일은 원본을 AAC 96kbps로 다시 인코딩했다(`afconvert -f m4af -d aac -b 96000`).

## 효과음

`boss-*`, `caught`, `task-stamp`, `messenger`, `meeting-hit-*`, `award`는 AI 효과음 생성기로 만든 파일이다.
나머지 효과음은 `src/shared/audio/spatial-audio.js`에서 Web Audio로 합성한다.
