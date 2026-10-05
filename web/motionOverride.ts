/**
 * Must be imported before anything that uses Reanimated.
 *
 * Windows Server, remote desktop sessions and some "performance" settings turn
 * OS animations off, and browsers then report `prefers-reduced-motion: reduce`.
 * The whole game would play with no animation at all. For the web build only,
 * report "no preference" unless the player opts in with `?motion=system`
 * (honour the OS) or `?motion=off`. Native builds always follow the OS.
 */
const scope = globalThis as unknown as {
  location?: { search: string };
  matchMedia?: (query: string) => { matches: boolean };
};

const mode = /[?&]motion=(\w+)/.exec(scope.location?.search ?? '')?.[1];
const realMatchMedia = scope.matchMedia?.bind(globalThis);

if (realMatchMedia && mode !== 'system') {
  const forceReduced = mode === 'off';
  scope.matchMedia = (query: string) => {
    const result = realMatchMedia(query);
    if (!/prefers-reduced-motion/.test(query)) {
      return result;
    }
    const wantsReduce = /reduce/.test(query);
    // `(prefers-reduced-motion: reduce)` matches only when we say so.
    return new Proxy(result, {
      get(target, prop) {
        if (prop === 'matches') {
          return wantsReduce ? forceReduced : !forceReduced;
        }
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
}
