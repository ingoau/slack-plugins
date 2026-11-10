// slick-plugin {"id":"ChannelLock","name":"Channel Lock","description":"Adds \"Lock channel\" to the right-click menu of channels you manage, so only admins can post and threads are off."}
(globalThis.__slickPlugins ??= []).push((require) => {
var module = { exports: {} }, exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  default: () => ChannelLock
});
module.exports = __toCommonJS(index_exports);
var import_slick = require("$slick");

// meta.ts
var id = "ChannelLock";
var pluginName = "Channel Lock";
var description = 'Adds "Lock channel" to the right-click menu of channels you manage, so only admins can post and threads are off.';
var category = "channels";
var defaultEnabled = false;
var settings = {};

// index.ts
var EVERYONE = "type:ra";
var ACTION_WAIT_MS = 1e4;
var LOCKS_KEY = "locks";
var KEY_PREFIX = "slick-channel-lock__";
var REASON = "slick-channel-lock";
var ChannelLock = class extends import_slick.SlickPlugin {
  static requiredAPIs = ["redux", "members", "modal"];
  static id = id;
  static pluginName = pluginName;
  static description = description;
  static category = category;
  static defaultEnabled = defaultEnabled;
  static settings = settings;
  /** channel id -> its posting prefs from before it was locked */
  locks = {};
  /** Slack's selector for which channel settings you can change, set once it loads */
  optionsToShow;
  /** channels with a lock or unlock in flight */
  busy = /* @__PURE__ */ new Set();
  async start() {
    this.api.waitForExport((exp) => typeof exp === "function" && exp.name === "additionalOptionsToShow").then((fn) => {
      this.optionsToShow = fn;
    }).catch((err) => this.log("could not find additionalOptionsToShow", err));
    this.locks = await this.api.storage.get(LOCKS_KEY, {});
    if (this.api.signal.aborted) return;
    this.api.redux.patchThunk("getContextMenuTemplate", (original) => (args, ...rest) => {
      const thunk = original(args, ...rest);
      return (dispatch, getState, ...more) => {
        const template = thunk(dispatch, getState, ...more);
        const channelId = args?.id;
        if (!channelId || !Array.isArray(template) || !this.canManage(getState(), channelId)) return template;
        const locked = !!this.locks[channelId];
        return [
          ...template,
          { key: `${KEY_PREFIX}separator`, type: "separator" },
          {
            key: locked ? `${KEY_PREFIX}unlock` : `${KEY_PREFIX}lock`,
            label: locked ? "Unlock channel" : "Lock channel",
            click: () => void (locked ? this.unlock(channelId) : this.lock(channelId))
          }
        ];
      };
    });
  }
  /** whether Slack would let you change this channel's posting permissions */
  canManage(state, channelId) {
    try {
      const option = this.optionsToShow?.(state, channelId)?.postingPermissions;
      return !!option?.shouldShow && !option.disabled;
    } catch (err) {
      this.log("could not check permissions for", channelId, err);
      return false;
    }
  }
  async saveLocks(next) {
    this.locks = next;
    if (!await this.api.storage.set(LOCKS_KEY, next)) throw new Error("Couldn't save the channel's permissions");
  }
  async lock(channelId) {
    if (this.busy.has(channelId)) return;
    this.busy.add(channelId);
    try {
      const [whoCanPost, canThread] = await Promise.all([
        this.getPref(channelId, "who_can_post"),
        this.getPref(channelId, "can_thread")
      ]);
      const previous = {
        who_can_post: serialize(whoCanPost),
        can_thread: serialize(canThread)
      };
      await this.saveLocks({
        ...this.locks,
        [channelId]: this.locks[channelId] ?? previous
      });
      const adminsOnly = this.adminsOnly(channelId);
      await this.setPrefs(channelId, {
        who_can_post: adminsOnly,
        can_thread: adminsOnly
      });
      this.log("locked", channelId, "was", previous);
    } catch (err) {
      this.fail("lock", channelId, err);
    } finally {
      this.busy.delete(channelId);
    }
  }
  async unlock(channelId) {
    const previous = this.locks[channelId];
    if (!previous || this.busy.has(channelId)) return;
    this.busy.add(channelId);
    try {
      await this.setPrefs(channelId, previous);
      const rest = { ...this.locks };
      delete rest[channelId];
      await this.saveLocks(rest);
      this.log("unlocked", channelId, "to", previous);
    } catch (err) {
      this.fail("unlock", channelId, err);
    } finally {
      this.busy.delete(channelId);
    }
  }
  /** "Admins only" as Slack's posting permissions dialog saves it, which keeps you able to post if you aren't one */
  adminsOnly(channelId) {
    const state = this.api.redux.getRawState();
    const me = this.api.members.getCurrentMemberId();
    const channel = state?.channels?.[channelId];
    const member = me ? state?.members?.[me] : void 0;
    const type = channel?.is_org_shared ? "type:org_admin" : "type:admin";
    const isAdmin = member?.is_admin || member?.is_owner;
    return isAdmin || !me ? type : `${type},user:${me}`;
  }
  async getPref(channelId, prefName) {
    const res = await this.dispatch("getChannelPrefFetcher", {
      channelId,
      prefName,
      reason: REASON
    });
    return res?.pref_value;
  }
  /** channels.prefs.set through Slack, which also updates its copy of the prefs */
  setPrefs(channelId, prefs) {
    return this.dispatch("setChannelPrefsByAPIAndUpdateStore", {
      channelId,
      newPrefs: JSON.stringify(prefs),
      reason: REASON
    });
  }
  /** dispatches one of Slack's thunks, failing if Slack doesn't have it in time */
  async dispatch(name, args) {
    const create = await within(this.api.redux.waitForThunkCreator(name), ACTION_WAIT_MS, `Slack's ${name} action`);
    const store = this.api.redux.getStore();
    if (!store) throw new Error(`Slack's ${name} action isn't available`);
    return store.dispatch(create(args));
  }
  fail(action, channelId, err) {
    this.log(`could not ${action}`, channelId, err);
    if (!this.api.isActive()) return;
    void this.api.modal.alert({
      title: `Couldn't ${action} the channel`,
      body: err instanceof Error ? err.message : String(err)
    });
  }
};
function within(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} isn't available`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function serialize(pref) {
  const parts = [
    ...(pref?.type ?? []).map((type) => `type:${type}`),
    ...(pref?.user ?? []).map((user) => `user:${user}`)
  ];
  return parts.length ? parts.join(",") : EVERYONE;
}
return module.exports.default;
});

//# sourceURL=slick:///plugins/ChannelLock.js
