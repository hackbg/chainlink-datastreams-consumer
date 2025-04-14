export class EventEmitter {
  listeners = {};

  on = (event, callback) => {
    this.listeners[event] ??= new Set();
    this.listeners[event].add(callback);
    return this;
  };

  off = (event, callback) => {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
    return this;
  };

  once = (event, callback) => {
    const onceCallback = (...args) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
    return this;
  };

  emit = (event, data) => {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        callback.call(this, data);
      }
    }
    return this;
  }
}
