# 소리 출처

## 배경음악

| 파일 | 곡 | 쓰는 곳 | 출처·라이선스 |
|---|---|---|---|
| `music-lobby.m4a` | Silent Partner - Dog Park | 대기실(끝나면 다시) | YouTube 스튜디오 오디오 보관함 |
| `office-music.m4a` | Office.mp3의 14:00~18:00 | 근무 중(크로스페이드 반복) | 확인 필요 |
| `music-result.m4a` | Kevin MacLeod - Hyperfun | 퇴근 뒤(한 번) | YouTube 스튜디오 오디오 보관함, CC BY 4.0 (아래 표기 필수) |
| `music-loser.m4a` | Reed Mathis - Here Come The Raindrops | 퇴근 뒤 가장 많이 잃은 사람(한 번) | YouTube 스튜디오 오디오 보관함 |

"Hyperfun" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 License
http://creativecommons.org/licenses/by/4.0/

게임 화면의 설정 창(음악 출처)에도 세 곡의 표기를 보여 준다. 음량은 근무 중 음악과 대기실·퇴근 음악(기본 15%)을 따로 조절한다.

모든 음악 파일은 원본을 AAC 96kbps로 다시 인코딩했다(`afconvert -f m4af -d aac -b 96000`).

## 효과음

`boss-*`, `caught`, `task-stamp`, `messenger`, `meeting-hit-*`, `award`는 AI 효과음 생성기로 만든 파일이다.
나머지 효과음은 `src/shared/audio/spatial-audio.js`에서 Web Audio로 합성한다.
