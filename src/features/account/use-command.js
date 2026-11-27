import { useEffect, useState } from 'react';

/**
 * 회원 명령 하나를 보내고 결과를 지켜본다. 오류는 scope별(actionErrors)로 오고, 성공은 명령마다 바뀌는
 * 값(watch(scope))이 달라진 것으로 안다. 한 번에 하나만 보낸다.
 * @returns run(command, scope), status(scope): null·'pending'·'failed'·'done', error(scope)
 */
export function useCommand({ actionErrors, connected, send }, watch) {
  const [request, setRequest] = useState(null);
  const latest = request ? actionErrors[request.scope] : null;
  const failed = Boolean(request && latest && latest !== request.error);
  const done = Boolean(request && !failed && watch(request.scope) !== request.value);
  const pending = Boolean(request && !failed && !done && connected);

  useEffect(() => {
    if (request && !connected && !failed && !done) setRequest(null);
  }, [request, connected, failed, done]);

  function run(command, scope) {
    if (!connected || pending || !send(command)) return false;
    setRequest({ scope, error: actionErrors[scope], value: watch(scope) });
    return true;
  }

  return {
    pending,
    run,
    status: scope => request?.scope !== scope ? null : failed ? 'failed' : done ? 'done' : pending ? 'pending' : null,
    error: scope => (request?.scope === scope && failed ? latest?.message : null),
  };
}
