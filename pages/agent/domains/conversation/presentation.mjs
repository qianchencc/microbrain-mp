// Keep a running node visible before a batched completion/next-node handoff.
export function createPresentation(apply, minimum = 180) {
  let chain = Promise.resolve(),
    stopped = false,
    timer,
    resume;
  const pause = () =>
    new Promise((resolve) => {
      resume = resolve;
      timer = setTimeout(resolve, minimum);
    });
  return {
    push(event) {
      if (stopped) return;
      if (
        !event.type.startsWith('tool.') &&
        !['run.completed', 'run.awaiting_confirmation', 'run.failed', 'run.aborted'].includes(
          event.type
        )
      ) {
        apply(event);
        return;
      }
      chain = chain.then(async () => {
        if (stopped) return;
        apply(event);
        if (event.type === 'tool.started') await pause();
      });
    },
    settle() {
      return chain;
    },
    cancel() {
      stopped = true;
      clearTimeout(timer);
      resume?.();
    },
  };
}
