import React, { useEffect, useState } from 'react';
import { deviceKey, deviceTag } from '../../shared/local-profile.js';

// 혼자 하기 퇴근 화면: 이달 같은 길이 판들 중 상위 몇 %인지 보여 주고, 명예의 전당에 올릴지 고르게 한다.
// 올리면 이름 옆에 이 기기의 꼬리표(#1234)가 붙어 같은 이름도 구분된다. 안 올려도 내 기록에는 남는다.
const namePattern = '[가-힣A-Za-z0-9_\\-]{2,10}';

export function SharePanel({ share, minutes, defaultName, connected, send, error }) {
  const [tag, setTag] = useState(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { deviceTag().then(setTag, () => setTag(null)); }, []);
  useEffect(() => { if (share.shared || error) setPending(false); }, [share.shared, error]);
  const month = Number(share.month?.split('-')[1]) || null;
  const { shared } = share;

  function onSubmit(event) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    if (!name || pending) return;
    if (send('SHARE ' + deviceKey() + ' ' + name)) setPending(true);
  }

  return <section aria-labelledby="share-title" className="share-panel relative mt-4 rounded-xl border p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div>
        <p className="text-sm font-semibold opacity-80">{month ? month + '월' : '이달'} {minutes}분 판 {share.runs.toLocaleString('ko-KR')}판 중</p>
        {/* 판이 적으면 "상위 100%"(1판 중 1등)처럼 어색하니 등수로 보여 준다. */}
        <h3 id="share-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {share.runs < 10 && share.rank ? `${share.rank}등` : `상위 ${share.topPercent}%`}
        </h3>
      </div>
      {shared
        ? <p role="status" className="text-sm font-semibold sm:text-right">
          🏆 <b>{shared.name}<span className="font-medium opacity-70">#{shared.tag}</span></b>로 명예의 전당에 올렸어요
          <span className="block text-xs font-medium opacity-80">
            {shared.rank ? `이달 ${minutes}분 ${shared.rank}위예요!` : '이달 10위 밖이에요. 다음 판에 도전해 보세요!'}
          </span>
        </p>
        : <form className="w-full max-w-md space-y-1.5 sm:w-auto" onSubmit={onSubmit}>
          <label htmlFor="share-name" className="text-xs font-semibold opacity-80">이 기록을 {month ? month + '월 ' : ''}명예의 전당에 올릴까요?</label>
          <div className="flex items-center gap-2">
            <input id="share-name" name="name" className="field min-w-0 flex-1" defaultValue={defaultName} required
              minLength={2} maxLength={10} pattern={namePattern} title="한글·영문·숫자·_·- 2~10자, 공백 없이" disabled={pending} />
            {tag && <span className="shrink-0 text-sm font-semibold tabular-nums opacity-70" title="이 기기의 꼬리표: 같은 이름도 구분돼요">#{tag}</span>}
            <button type="submit" className="primary-action shrink-0 rounded-lg px-3.5 py-2 text-sm font-bold" disabled={!connected || pending}>
              {pending ? '올리는 중…' : '올리기'}
            </button>
          </div>
          {error ? <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
            : <p className="text-xs opacity-75">안 올려도 내 기록에는 남아요.</p>}
        </form>}
    </div>
  </section>;
}
