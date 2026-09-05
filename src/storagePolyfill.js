const PREFIX = "cgapp:";

function storageKey(key, shared) {
  return `${PREFIX}${shared ? "shared" : "user"}:${key}`;
}

window.storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(storageKey(key, shared));
    if (raw === null) return null;
    return { key, value: raw, shared };
  },

  async set(key, value, shared = false) {
    localStorage.setItem(storageKey(key, shared), value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const fullKey = storageKey(key, shared);
    const existed = localStorage.getItem(fullKey) !== null;
    localStorage.removeItem(fullKey);
    return { key, deleted: existed, shared };
  },

  async list(prefix = "", shared = false) {
    const nsPrefix = `${PREFIX}${shared ? "shared" : "user"}:${prefix}`;
    const stripLen = `${PREFIX}${shared ? "shared" : "user"}:`.length;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(nsPrefix)) {
        keys.push(fullKey.slice(stripLen));
      }
    }
    return { keys, prefix, shared };
  },
};
