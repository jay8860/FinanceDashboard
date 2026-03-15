if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((nextResolve, nextReject) => {
      resolve = nextResolve;
      reject = nextReject;
    });
    return { promise, resolve, reject };
  };
}

const readableStreamPrototype = globalThis.ReadableStream?.prototype;

if (readableStreamPrototype && typeof readableStreamPrototype.values !== 'function') {
  readableStreamPrototype.values = function values(options = {}) {
    const reader = this.getReader();
    const preventCancel = options?.preventCancel === true;

    return {
      async next() {
        return reader.read();
      },
      async return(value) {
        try {
          if (!preventCancel) {
            await reader.cancel(value);
          }
        } catch {
          // Ignore cancellation errors while unwinding iteration.
        } finally {
          reader.releaseLock?.();
        }
        return { done: true, value };
      },
      async throw(reason) {
        try {
          if (!preventCancel) {
            await reader.cancel(reason);
          }
        } catch {
          // Ignore cancellation errors while unwinding iteration.
        } finally {
          reader.releaseLock?.();
        }
        throw reason;
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  };
}

if (readableStreamPrototype && typeof readableStreamPrototype[Symbol.asyncIterator] !== 'function') {
  readableStreamPrototype[Symbol.asyncIterator] = function asyncIterator() {
    return this.values();
  };
}
