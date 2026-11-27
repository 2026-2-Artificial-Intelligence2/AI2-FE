import React, { useEffect, useRef, useState } from 'react';
import { enableSound } from '../../shared/audio/spatial-audio.js';

import { AccountEntry } from './account-entry.jsx';
import { LeaderboardPanel } from './leaderboard-panel.jsx';
import officeLanding from './office-landing.webp';

const seats = 4;
const soloMinutes = [5, 10, 15, 20];

function SoloDuration({ id, minutes, disabled, onChange }) {
  return (
    <select id={id} className='field min-w-0' value={minutes} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {soloMinutes.map(value => <option key={value} value={value}>{value}분</option>)}
    </select>
  );
}

export function Entry({ connected, send, status, account, accountNotice, actionErrors, startingSolo, leaderboard }) {
  const [mode, setMode] = useState('TEAM');
  const [minutes, setMinutes] = useState(10);
  const requested = useRef(false);
  const ready = connected && Boolean(account);
  const createError = actionErrors.CREATE?.message;
  const joinError = actionErrors.JOIN?.message;

  // 첫 화면에 들어오면 명예의 전당을 한 번 불러온다(연결이 다시 맺어지면 다시).
  useEffect(() => {
    if (!connected) { requested.current = false; return; }
    if (!requested.current && !leaderboard) requested.current = send('LEADERBOARD');
  }, [connected, leaderboard, send]);

  return (
    <div className='entry-page'>
      {/* 넓은 화면: 왼쪽에 사진(원래 비율 그대로, 잘리지 않음)과 명예의 전당, 오른쪽에 입장 조작.
          좁은 화면: 사진 → 입장 조작 → 명예의 전당 순서로 쌓인다. */}
      <div className='panel entry-visual'>
        <img src={officeLanding} className='entry-illustration' alt='옆에 선 부장님을 흘끗 보며 키보드를 누르는 직원' width={1672} height={941} />
      </div>
      <section aria-labelledby='entry-title' className='panel entry-card'>
        <div className='entry-controls space-y-5'>
          <div>
            <h2 id='entry-title' className='text-3xl font-extrabold tracking-tight'>사무실 입장</h2>
            <p className='mt-2 text-sm leading-relaxed text-ui-secondary'>부장님 몰래 주식으로 퇴근 전까지 순자산을 불려요.</p>
            {status && <p id='status' role='status' className='mt-2 text-xs text-ui-secondary'>{status}</p>}
          </div>

          <AccountEntry account={account} notice={accountNotice} actionErrors={actionErrors} connected={connected} send={send} />

          <section aria-labelledby='play-title' className={'space-y-3 transition-opacity ' + (ready ? '' : 'opacity-60')}>
            <div className='flex items-center justify-between gap-2'>
              <h3 id='play-title' className='text-sm font-bold'>어떻게 할까요?</h3>
              {!account && <p className='text-xs text-ui-secondary'>먼저 이름을 정해 주세요</p>}
            </div>
            <div role='tablist' aria-label='플레이 방식' className='grid grid-cols-2 gap-2'>
              {[
                { id: 'TEAM', title: '함께 하기', sub: '친구 2~4명' },
                { id: 'SOLO', title: '혼자 하기', sub: '1인 · 명예의 전당' },
              ].map(item => <button key={item.id} type='button' role='tab' aria-selected={mode === item.id}
                className={'rounded-xl border px-3 py-2.5 text-left transition-colors ' + (mode === item.id
                  ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 dark:border-indigo-400 dark:bg-[var(--dark-selection)] dark:ring-indigo-400'
                  : 'border-ui-border hover:bg-ui-subtle')}
                onClick={() => setMode(item.id)}>
                <span className='block text-sm font-bold'>{item.title}</span>
                <span className='block text-xs text-ui-secondary'>{item.sub}</span>
              </button>)}
            </div>

            {/* 두 화면을 같은 칸에 겹쳐 두고 보이는 것만 바꿔, 함께/혼자를 바꿔도 크기가 그대로다. */}
            <div className='grid'>
            <div role='tabpanel' aria-label='함께 하기' aria-hidden={mode !== 'TEAM'} inert={mode !== 'TEAM'}
              className={'col-start-1 row-start-1 space-y-3 ' + (mode === 'TEAM' ? '' : 'invisible')}>
              <button id='create' type='button' disabled={!ready}
                className='primary-action w-full rounded-lg px-4 py-2.5 text-sm font-bold'
                onClick={() => { enableSound(); send('CREATE'); }}>
                방 만들기
              </button>
              {createError && <p role='alert' className='text-xs text-rose-700 dark:text-rose-300'>{createError}</p>}
              <div className='flex items-center gap-2 text-[11px] text-ui-caption' aria-hidden='true'>
                <span className='h-px flex-1 bg-ui-border' />또는 초대 코드로<span className='h-px flex-1 bg-ui-border' />
              </div>
              <form className='flex items-center gap-2'
                onSubmit={event => {
                  event.preventDefault();
                  enableSound();
                  send('JOIN ' + new FormData(event.currentTarget).get('code').trim());
                }}>
                <label htmlFor='code' className='sr-only'>초대 코드</label>
                <input name='code' id='code' className='field min-w-0 flex-1 text-center font-mono tracking-[0.3em]'
                  maxLength={6} inputMode='numeric' pattern='[0-9]{6}' autoComplete='off' required disabled={!ready}
                  placeholder='000000' aria-invalid={joinError ? true : undefined}
                  aria-describedby={joinError ? 'join-error' : undefined} />
                <button id='join' className='control self-stretch px-4' disabled={!ready}>입장</button>
              </form>
              {joinError && <p id='join-error' role='alert' className='text-xs text-rose-700 dark:text-rose-300'>{joinError}</p>}
            </div>
              <form role='tabpanel' aria-label='혼자 하기' aria-hidden={mode !== 'SOLO'} inert={mode !== 'SOLO'}
                className={'col-start-1 row-start-1 space-y-3 ' + (mode === 'SOLO' ? '' : 'invisible')}
                onSubmit={event => {
                  event.preventDefault();
                  if (!ready) return;
                  enableSound();
                  send('SOLO ' + minutes);
                }}>
                <div className='space-y-1'>
                  <p id='solo-minutes-label' className='text-xs font-semibold text-ui-secondary'>근무 시간</p>
                  <div role='group' aria-labelledby='solo-minutes-label' className='segments grid w-full grid-cols-4'>
                    {soloMinutes.map(value => <button key={value} type='button' aria-pressed={minutes === value}
                      disabled={!ready} onClick={() => setMinutes(value)}>{value}분</button>)}
                  </div>
                </div>
                <button id='solo-start' type='submit' disabled={!ready}
                  className='primary-action w-full rounded-lg px-4 py-2.5 text-sm font-bold'>
                  {startingSolo ? '출근하는 중…' : minutes + '분 혼자 출근하기'}
                </button>
                {actionErrors.SOLO && <p role='alert' className='text-xs text-rose-700 dark:text-rose-300'>{actionErrors.SOLO.message}</p>}
                {(() => {
                  const top = leaderboard?.find(board => board.minutes === minutes)?.entries[0];
                  return top && <p className='rounded-lg bg-ui-subtle px-3 py-2 text-xs text-ui-secondary'>
                    {minutes}분 1위 <b className='text-ui-text'>{top.name}</b>{' '}
                    <b className='tabular-nums text-rose-700 dark:text-rose-300'>{(top.bestReturnPercent > 0 ? '+' : '') + top.bestReturnPercent.toFixed(2)}%</b>
                    {' '}· 이 기록을 넘어 보세요!
                  </p>;
                })()}
                <p className='text-xs text-ui-secondary'>
                  {account?.member ? '기록이 ' + minutes + '분 명예의 전당에 올라가요.' : '게스트 기록은 명예의 전당에 오르지 않아요.'}
                </p>
              </form>
            </div>
          </section>
        </div>
      </section>

      <LeaderboardPanel durations={soloMinutes} minutes={minutes} onMinutes={setMinutes} boards={leaderboard}
        me={account?.member ? account.name : null} connected={connected} error={actionErrors.LEADERBOARD?.message}
        onRetry={() => send('LEADERBOARD')} />
    </div>
  );
}

function InviteCode({ code }) {
  const [feedback, setFeedback] = useState('');
  const codeText = useRef(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback('초대 코드를 복사했어요.');
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(codeText.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      setFeedback('선택된 코드를 복사해서 공유해 주세요.');
    }
  }

  return (
    <div>
      <p className='text-xs font-semibold text-ui-secondary'>초대 코드</p>
      <div className='mt-1 flex flex-wrap items-center gap-3'>
        <span id='roomTitle' ref={codeText} className='font-mono text-3xl font-bold tracking-[0.14em]'>
          {code}
        </span>
        <button className='control px-2.5 py-1 text-xs' onClick={copy}>
          복사
        </button>
      </div>
      {feedback && (
        <p role='status' className='mt-1 text-xs text-ui-secondary'>
          {feedback}
        </p>
      )}
    </div>
  );
}

function Players({ members, you }) {
  return (
    <section className='panel lobby-players @container flex min-w-0 flex-col p-5' aria-labelledby='players-title'>
      <header className='mb-4 flex shrink-0 items-center justify-between gap-2'>
        <h3 id='players-title' className='font-bold'>
          참가자 자리
        </h3>
        <p className='text-sm font-semibold text-ui-secondary'>
          {members.length} / {seats}명
        </p>
      </header>
      {/* 칸 수는 창 너비가 아니라 이 칸의 너비로 정한다(메신저·설정과 나란히 놓이면 좁아진다). */}
      <ul className='grid min-h-0 content-start gap-2 overflow-y-auto @md:grid-cols-2'>
        {Array.from({ length: seats }, (_, index) => {
          const member = members[index];
          const mine = member?.label === you;
          return (
            <li
              key={member?.label ?? 'empty-' + index}
              className={
                'flex min-h-22 items-center gap-3 rounded-lg border p-3 min-[45rem]:min-h-21 ' +
                (mine
                  ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-[var(--dark-selection)]'
                  : member
                    ? 'border-ui-border bg-ui-surface'
                    : 'border-dashed border-ui-input bg-ui-subtle')
              }>
              <span
                aria-hidden='true'
                className={'grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold ' + (member ? 'bg-slate-900 text-white' : 'bg-ui-surface text-ui-caption ring-1 ring-ui-border')}>
                {Array.from(member?.label?.normalize('NFC').trim() ?? '')[0] ?? '+'}
              </span>
              {member ? (
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                    <span className='min-w-0 text-sm font-bold break-keep [overflow-wrap:anywhere]'>
                      {member.label}
                      {mine && ' (나)'}
                    </span>
                    {member.host && <span className='rounded bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200'>방장</span>}
                    <span className={'rounded px-1.5 py-0.5 text-[11px] font-semibold ' + (member.member
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-ui-muted text-ui-secondary')}>{member.member ? '회원' : '게스트'}</span>
                  </div>
                  <p className={'mt-1 text-xs ' + (member.online ? 'text-ui-secondary' : 'font-medium text-amber-800 dark:text-amber-200')}>{member.online ? '접속 중' : '연결 끊김'}</p>
                </div>
              ) : (
                <p className='text-sm text-ui-caption'>빈 자리</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function durationText(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return [minutes ? minutes + '분' : '', rest ? rest + '초' : ''].filter(Boolean).join(' ');
}

function RoomSettings({ sessionSeconds, host, connected, lengthError, startError, canStart, solo, send }) {
  const [minutes, setMinutes] = useState(String(Math.ceil(sessionSeconds / 60)));
  const [request, setRequest] = useState(null);
  const valid = solo ? soloMinutes.includes(Number(minutes)) : /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 60;
  const requestedSeconds = Number(minutes) * 60;
  const pending = connected && request && request.seconds !== sessionSeconds && !lengthError;
  const changed = requestedSeconds !== sessionSeconds;

  return (
    <section className={'panel space-y-4 p-5' + (host ? '' : ' self-start')} aria-labelledby='settings-title'>
      <h3 id='settings-title' className='font-bold'>
        방 설정
      </h3>
      <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
        <span className='text-ui-secondary'>적용된 근무 시간</span>
        <strong data-lobby-duration className='rounded-md bg-indigo-50 dark:bg-[var(--dark-selection)] px-2 py-1 text-indigo-900 dark:text-indigo-200'>
          {durationText(sessionSeconds)}
        </strong>
      </div>
      {host ? (
        <>
          <form
            className='space-y-2'
            onSubmit={(event) => {
              event.preventDefault();
              if (!connected || !valid || !changed || pending) return;
              if (send('LENGTH ' + Number(minutes))) setRequest({ seconds: requestedSeconds });
            }}>
            <label className='block text-sm font-semibold' htmlFor='room-minutes'>
              {solo ? '근무 시간 변경' : '근무 시간 변경 (1~60분)'}
            </label>
            <div className='flex gap-2'>
              {solo ? <SoloDuration id='room-minutes' minutes={minutes} disabled={!connected || Boolean(pending)} onChange={setMinutes} />
                : <input
                id='room-minutes'
                type='number'
                min='1'
                max='60'
                step='1'
                required
                disabled={!connected || Boolean(pending)}
                className='field min-w-0 flex-1'
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />}
              <button className='control' disabled={!connected || !valid || !changed || Boolean(pending)}>
                {pending ? '적용 중…' : '적용'}
              </button>
            </div>
            {lengthError && (
              <p role='alert' className='text-xs text-rose-700 dark:text-rose-300'>
                {lengthError}
              </p>
            )}
          </form>
          <div className='space-y-2 border-t border-ui-border pt-4'>
            <button
              id='start'
              disabled={!connected || !canStart || Boolean(pending)}
              className='primary-action w-full rounded-lg px-4 py-2.5 text-sm font-bold'
              onClick={() => {
                enableSound();
                send('START');
              }}>
              {solo ? '혼자 하기' : '게임 시작'}
            </button>
            {startError && (
              <p role='alert' className='text-xs text-rose-700 dark:text-rose-300'>
                {startError}
              </p>
            )}
            {!canStart && <p className='text-xs text-ui-secondary'>두 명 이상 모이면 시작할 수 있어요.</p>}
          </div>
        </>
      ) : (
        <p className='border-t border-ui-border pt-4 text-sm text-ui-secondary'>방장이 게임을 시작할 때까지 기다려 주세요.</p>
      )}
    </section>
  );
}

export function Lobby({ game, host, send, messenger }) {
  const { room, connected, status, actionErrors } = game;
  return (
    <section id='lobby' className={room.solo ? 'mx-auto max-w-2xl' : 'lobby-shell min-w-0'} aria-labelledby='lobby-title'>
      <div className='lobby-main min-w-0 space-y-3'>
        <header className='panel bg-ui-muted flex flex-wrap items-center justify-between gap-5 p-5 sm:px-7'>
          <div>
            <h2 id='lobby-title' className='text-xl font-extrabold'>
              {room.solo ? '혼자 하기 대기실' : '대기실'}
            </h2>
            <p id='status' role='status' className='mt-1 text-sm text-ui-secondary'>
              {status || actionErrors.GENERAL?.message || (room.round > 1 ? room.round + '번째 판 · 시작 대기 중' : '시작 대기 중')}
            </p>
          </div>
          {!room.solo && <InviteCode code={room.code} />}
        </header>
        <div className={room.solo ? undefined : 'lobby-grid' + (host ? '' : ' lobby-grid--guest')}>
          {!room.solo && <Players members={room.members ?? []} you={room.youLabel} />}
          <RoomSettings
            key={room.sessionSeconds + '-' + connected}
            sessionSeconds={room.sessionSeconds}
            host={host}
            connected={connected}
            lengthError={actionErrors.LENGTH?.message}
            startError={actionErrors.START?.message}
            canStart={room.solo || room.room.players.length >= 2}
            solo={room.solo}
            send={send}
          />
        </div>
      </div>
      {messenger}
    </section>
  );
}
