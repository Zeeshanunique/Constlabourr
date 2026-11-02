// Polyfill InteractionManager for libraries relying on older React Native API
let ReactNative: any = null;
try {
  // @ts-ignore
  ReactNative = require('react-native');
} catch {
  // Ignore in case react-native exports are restricted
}

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
if (ReactNative) {
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
}

// Polyfill globally
if (typeof globalThis !== 'undefined') {
  try {
    (globalThis as any).InteractionManager = interactionManagerPolyfill;
    if ((globalThis as any).global) {
      (globalThis as any).global.InteractionManager = interactionManagerPolyfill;
    }
  } catch {}
}
if (typeof window !== 'undefined') {
  try {
    (window as any).InteractionManager = interactionManagerPolyfill;
  } catch {}
}

export default interactionManagerPolyfill;

