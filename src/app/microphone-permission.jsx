import React, { useRef, useState } from 'react';
import { Dialog } from '../shared/ui/dialog.jsx';

const preferenceKey = 'office-stock-microphone-preference';

export function useMicrophonePreference() {
  const [preference, setPreference] = useState(() => {
    try {
      const saved = localStorage.getItem(preferenceKey);
      return saved === 'allowed' || saved === 'skipped' ? saved : null;
    } catch {
      return null;
    }
  });

  function choose(value) {
    setPreference(value);
    try {
      localStorage.setItem(preferenceKey, value);
    } catch {
      // The current visit still remembers this choice.
    }
  }

  return { choiceNeeded: preference === null, choose };
}

export function MicrophonePermission({ onChoose }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const asking = useRef(false);
  const skip = () => onChoose('skipped');

  async function allow() {
    if (asking.current) return;
    asking.current = true;
    setPending(true);
    setMessage('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS 또는 localhost에서 마이크 권한을 요청할 수 있어요.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      onChoose('allowed');
    } catch (error) {
      setMessage(error.name === 'NotAllowedError' ? '브라우저에서 마이크 권한이 허용되지 않았어요. 지금은 마이크 없이 계속할 수 있어요.' : error.message);
    } finally {
      asking.current = false;
      setPending(false);
    }
  }

  return <Dialog id="microphone-permission" title="마이크를 사용할까요?" pending={pending} onDismiss={skip}>
    <div className="space-y-4 p-5">
      <p className="text-sm leading-relaxed text-ui-secondary">게임에서 마이크를 켜면 같은 방에 소리 크기만 표시돼요.
        실제 마이크 사용은 입장 후 <b className="text-ui-text">마이크 켜기</b>를 눌렀을 때 시작해요.</p>
      {message && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{message}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="control" onClick={skip} disabled={pending}>마이크 없이 계속</button>
        <button type="button" className="control border-ui-input bg-ui-muted" onClick={allow} disabled={pending}>
          {pending ? '권한 확인 중…' : '마이크 허용'}
        </button>
      </div>
    </div>
  </Dialog>;
}
