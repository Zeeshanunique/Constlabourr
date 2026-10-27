// Use raw CommonJS require so Babel doesn't wrap react-native in an immutable _interopNamespace proxy
// @ts-ignore
const ReactNative = require('react-native');

const interactionManagerPolyfill = {
  Events: {
    interactionStart: 'interactionStart',
    interactionComplete: 'interactionComplete',
  },
  runAfterInteractions(task?: any) {
    let handle: any;
    const promise = new Promise((resolve) => {
      handle = requestAnimationFrame(() => {
        resolve(typeof task === 'function' ? task() : undefined);
      });
    });
    return {
      then: promise.then.bind(promise),
      done: (...args: any[]) => ((promise as any).done ? (promise as any).done(...args) : promise.then(...args)),
      cancel: () => cancelAnimationFrame(handle),
    };
  },
  createInteractionHandle() {
    return 1;
  },
  clearInteractionHandle(_handle?: number) {},
  setDeadline(_deadline?: number) {},
  addListener(_eventType?: string, _listener?: any) {
    return { remove: () => {} };
  },
};

// Polyfill on raw ReactNative module exports and default export if present
const targets = [ReactNative, ReactNative?.default].filter(Boolean);

for (const target of targets) {
  try {
    Object.defineProperty(target, 'InteractionManager', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: interactionManagerPolyfill,
    });
  } catch {
    try {
      target.InteractionManager = interactionManagerPolyfill;
    } catch {
      // ignore
    }
  }
}

// Polyfill globally
if (typeof globalThis !== 'undefined') {
  (globalThis as any).InteractionManager = interactionManagerPolyfill;
  if ((globalThis as any).global) {
    (globalThis as any).global.InteractionManager = interactionManagerPolyfill;
  }
}
if (typeof window !== 'undefined') {
  (window as any).InteractionManager = interactionManagerPolyfill;
}

export default interactionManagerPolyfill;

