import React, { useRef, useState } from 'react';
import { enableSound } from '../../shared/audio/spatial-audio.js';

import officeLanding from './office-landing.webp';

const seats = 4;

export function Entry({ connected, send }) {
  return (
    <section aria-labelledby='entry-title' className='panel entry-card'>
      <img
        src={officeLanding}
        className='entry-illustration'
        alt='옆에 선 부장님을 흘끗 보며 키보드를 누르는 직원'
        width={1672}
        height={941}
      />
      <div className='entry-controls'>
        <h2 id='entry-title' className='text-3xl font-extrabold tracking-tight'>
          사무실 입장
        </h2>
        <p className='mt-2 text-sm leading-relaxed text-ui-secondary'>같은 방의 직원들과 퇴근까지 순자산을 겨뤄요.</p>
        <button
          id='create'
          type='button'
          disabled={!connected}
          className='arrival-action mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-bold'
          onClick={() => {
            enableSound();
            send('CREATE');
          }}>
          방 만들기
        </button>
        <form
          className='mt-5 flex flex-col gap-2 border-t border-ui-border pt-5'
          onSubmit={(event) => {
            event.preventDefault();
            enableSound();
            send('JOIN ' + new FormData(event.currentTarget).get('code').trim());
          }}>
          <label htmlFor='code' className='text-sm font-bold'>
            초대 코드로 입장
          </label>
          <div className='flex items-center gap-2'>
            <input
              name='code'
              id='code'
              className='field min-w-0 flex-1 font-mono tracking-[0.15em]'
              maxLength={6}
              inputMode='numeric'
              pattern='[0-9]{6}'
              autoComplete='off'
              required
              disabled={!connected}
              placeholder='6자리 숫자'
            />
            <button id='join' className='control self-stretch px-4' disabled={!connected}>
              입장
            </button>
          </div>
        </form>
      </div>
    </section>
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
    <section className='panel p-5' aria-labelledby='players-title'>
      <header className='mb-4 flex items-center justify-between gap-2'>
        <h3 id='players-title' className='font-bold'>
          참가자 자리
        </h3>
        <p className='text-sm font-semibold text-ui-secondary'>
          {members.length} / {seats}명
        </p>
      </header>
      <ul className='grid gap-2 sm:grid-cols-2'>
        {Array.from({ length: seats }, (_, index) => {
          const member = members[index];
          const mine = member?.label === you;
          return (
            <li
              key={member?.label ?? 'empty-' + index}
              className={
                'flex min-h-22 items-center gap-3 rounded-lg border p-3 ' +
                (mine ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-[var(--dark-selection)]' : member ? 'border-ui-border bg-ui-surface' : 'border-dashed border-ui-input bg-ui-subtle')
              }>
              <span
                aria-hidden='true'
                className={'grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold ' + (member ? 'bg-slate-900 text-white' : 'bg-ui-surface text-ui-caption ring-1 ring-ui-border')}>
                {member?.label ?? '+'}
              </span>
              {member ? (
                <div>
                  <div className='flex flex-wrap items-center gap-x-2'>
                    <span className='text-sm font-bold'>
                      {member.label}
                      {mine && ' (나)'}
                    </span>
                    {member.host && <span className='rounded bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200'>방장</span>}
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

function RoomSettings({ sessionSeconds, host, connected, lastError, canStart, send }) {
  const [minutes, setMinutes] = useState(String(Math.ceil(sessionSeconds / 60)));
  const [request, setRequest] = useState(null);
  const valid = /^\d+$/.test(minutes) && Number(minutes) >= 1 && Number(minutes) <= 60;
  const requestedSeconds = Number(minutes) * 60;
  const pending = connected && request && request.seconds !== sessionSeconds && request.error === lastError;
  const changed = requestedSeconds !== sessionSeconds;

  return (
    <section className='panel space-y-4 p-5' aria-labelledby='settings-title'>
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
              if (send('LENGTH ' + Number(minutes))) setRequest({ seconds: requestedSeconds, error: lastError });
            }}>
            <label className='block text-sm font-semibold' htmlFor='room-minutes'>
              근무 시간 변경 (1~60분)
            </label>
            <div className='flex gap-2'>
              <input
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
              />
              <button className='control' disabled={!connected || !valid || !changed || Boolean(pending)}>
                {pending ? '적용 중…' : '적용'}
              </button>
            </div>
          </form>
          <div className='space-y-2 border-t border-ui-border pt-4'>
            <button
              id='start'
              disabled={!connected || !canStart || Boolean(pending)}
              className='w-full rounded-lg bg-indigo-700 dark:bg-[#3d3b50] dark:hover:bg-[#4a4860] px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800'
              onClick={() => {
                enableSound();
                send('START');
              }}>
              게임 시작
            </button>
            {!canStart && <p className='text-xs text-ui-secondary'>두 명 이상 모이면 시작할 수 있어요.</p>}
          </div>
        </>
      ) : (
        <p className='border-t border-ui-border pt-4 text-sm text-ui-secondary'>방장이 게임을 시작할 때까지 기다려 주세요.</p>
      )}
    </section>
  );
}

export function Lobby({ game, host, send }) {
  const { room, connected, lastError } = game;
  return (
    <section id='lobby' className='min-w-0 space-y-3' aria-labelledby='lobby-title'>
      <header className='panel arrival-banner flex flex-wrap items-center justify-between gap-5 p-5 sm:px-7'>
        <div>
          <h2 id='lobby-title' className='text-xl font-extrabold'>
            대기실
          </h2>
          {room.round > 1 && <p className='mt-1 text-sm text-ui-secondary'>{room.round}번째 판</p>}
        </div>
        <InviteCode code={room.code} />
      </header>
      <div className='grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]'>
        <Players members={room.members ?? []} you={room.youLabel} />
        <RoomSettings
          key={room.sessionSeconds + '-' + connected}
          sessionSeconds={room.sessionSeconds}
          host={host}
          connected={connected}
          lastError={lastError}
          canStart={room.room.players.length >= 2}
          send={send}
        />
      </div>
    </section>
  );
}
