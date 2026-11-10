// Adds "Lock channel" to the right-click menu of channels you manage, so only admins can post and threads are off

import { type MenuTemplateItem, SlickPlugin } from '$slick';
import * as meta from './meta.ts';

/** a posting pref as channels.prefs.get returns it */
type Restriction = { type?: string[]; user?: string[] };
/** what a lock replaced, as channels.prefs.set takes it */
type SavedPrefs = { who_can_post: string; can_thread: string };
type Locks = Record<string, SavedPrefs>;
type Channel = { is_org_shared?: boolean };
type Member = { is_admin?: boolean; is_owner?: boolean };
type OptionsToShow = (
  state: unknown,
  channelId: string,
) => { postingPermissions?: { shouldShow?: boolean; disabled?: boolean } };

/** Slack's "Everyone" posting setting, which is also what an unset pref means */
const EVERYONE = 'type:ra';
/** how long to wait for Slack's pieces where they're used */
const ACTION_WAIT_MS = 10_000;
const LOCKS_KEY = 'locks';
const KEY_PREFIX = 'slick-channel-lock__';
const REASON = 'slick-channel-lock';

export default class ChannelLock extends SlickPlugin<typeof meta.settings> {
  static readonly requiredAPIs = ['redux', 'members', 'modal'] as const;
  static readonly id = meta.id;
  static readonly pluginName = meta.pluginName;
  static readonly description = meta.description;
  static readonly category = meta.category;
  static readonly defaultEnabled = meta.defaultEnabled;
  static readonly settings = meta.settings;

  /** channel id -> its posting prefs from before it was locked */
  private locks: Locks = {};
  /** Slack's selector for which channel settings you can change, set once it loads */
  private optionsToShow: OptionsToShow | undefined;
  /** channels with a lock or unlock in flight */
  private busy = new Set<string>();

  async start() {
    this.api
      .waitForExport<OptionsToShow>((exp) => typeof exp === 'function' && exp.name === 'additionalOptionsToShow')
      .then((fn) => {
        this.optionsToShow = fn;
      })
      .catch((err) => this.log('could not find additionalOptionsToShow', err));
    this.locks = await this.api.storage.get<Locks>(LOCKS_KEY, {});
    if (this.api.signal.aborted) return;

    // the right-click menu on a channel's sidebar row, header or link
    this.api.redux.patchThunk('getContextMenuTemplate', (original) => (args: { id?: string }, ...rest: unknown[]) => {
      const thunk = original(args, ...rest);
      return (dispatch: (action: unknown) => unknown, getState: () => any, ...more: unknown[]) => {
        const template: MenuTemplateItem[] = thunk(dispatch, getState, ...more);
        const channelId = args?.id;
        if (!channelId || !Array.isArray(template) || !this.canManage(getState(), channelId)) return template;
        const locked = !!this.locks[channelId];
        return [
          ...template,
          { key: `${KEY_PREFIX}separator`, type: 'separator' },
          {
            key: locked ? `${KEY_PREFIX}unlock` : `${KEY_PREFIX}lock`,
            label: locked ? 'Unlock channel' : 'Lock channel',
            click: () => void (locked ? this.unlock(channelId) : this.lock(channelId)),
          },
        ];
      };
    });
  }

  /** whether Slack would let you change this channel's posting permissions */
  private canManage(state: unknown, channelId: string): boolean {
    try {
      const option = this.optionsToShow?.(state, channelId)?.postingPermissions;
      return !!option?.shouldShow && !option.disabled;
    } catch (err) {
      this.log('could not check permissions for', channelId, err);
      return false;
    }
  }

  private async saveLocks(next: Locks) {
    this.locks = next;
    if (!(await this.api.storage.set(LOCKS_KEY, next))) throw new Error("Couldn't save the channel's permissions");
  }

  private async lock(channelId: string) {
    if (this.busy.has(channelId)) return;
    this.busy.add(channelId);
    try {
      const [whoCanPost, canThread] = await Promise.all([
        this.getPref(channelId, 'who_can_post'),
        this.getPref(channelId, 'can_thread'),
      ]);
      const previous: SavedPrefs = {
        who_can_post: serialize(whoCanPost),
        can_thread: serialize(canThread),
      };
      // saved first, so a lock that half-applies can still be undone
      await this.saveLocks({
        ...this.locks,
        [channelId]: this.locks[channelId] ?? previous,
      });
      const adminsOnly = this.adminsOnly(channelId);
      // can_thread matching who_can_post is Slack's "Allow threads" turned off
      await this.setPrefs(channelId, {
        who_can_post: adminsOnly,
        can_thread: adminsOnly,
      });
      this.log('locked', channelId, 'was', previous);
    } catch (err) {
      this.fail('lock', channelId, err);
    } finally {
      this.busy.delete(channelId);
    }
  }

  private async unlock(channelId: string) {
    const previous = this.locks[channelId];
    if (!previous || this.busy.has(channelId)) return;
    this.busy.add(channelId);
    try {
      await this.setPrefs(channelId, previous);
      const rest = { ...this.locks };
      delete rest[channelId];
      await this.saveLocks(rest);
      this.log('unlocked', channelId, 'to', previous);
    } catch (err) {
      this.fail('unlock', channelId, err);
    } finally {
      this.busy.delete(channelId);
    }
  }

  /** "Admins only" as Slack's posting permissions dialog saves it, which keeps you able to post if you aren't one */
  private adminsOnly(channelId: string): string {
    const state = this.api.redux.getRawState();
    const me = this.api.members.getCurrentMemberId();
    const channel: Channel | undefined = state?.channels?.[channelId];
    const member: Member | undefined = me ? state?.members?.[me] : undefined;
    const type = channel?.is_org_shared ? 'type:org_admin' : 'type:admin';
    const isAdmin = member?.is_admin || member?.is_owner;
    return isAdmin || !me ? type : `${type},user:${me}`;
  }

  private async getPref(channelId: string, prefName: string): Promise<Restriction | null | undefined> {
    const res = (await this.dispatch('getChannelPrefFetcher', {
      channelId,
      prefName,
      reason: REASON,
    })) as {
      pref_value?: Restriction | null;
    };
    return res?.pref_value;
  }

  /** channels.prefs.set through Slack, which also updates its copy of the prefs */
  private setPrefs(channelId: string, prefs: SavedPrefs) {
    return this.dispatch('setChannelPrefsByAPIAndUpdateStore', {
      channelId,
      newPrefs: JSON.stringify(prefs),
      reason: REASON,
    });
  }

  /** dispatches one of Slack's thunks, failing if Slack doesn't have it in time */
  private async dispatch(name: string, args: object): Promise<unknown> {
    const create = await within(this.api.redux.waitForThunkCreator(name), ACTION_WAIT_MS, `Slack's ${name} action`);
    // a user action, so the store exists by now
    const store = this.api.redux.getStore();
    if (!store) throw new Error(`Slack's ${name} action isn't available`);
    return store.dispatch(create(args));
  }

  private fail(action: 'lock' | 'unlock', channelId: string, err: unknown) {
    this.log(`could not ${action}`, channelId, err);
    if (!this.api.isActive()) return;
    void this.api.modal.alert({
      title: `Couldn't ${action} the channel`,
      body: err instanceof Error ? err.message : String(err),
    });
  }
}

/** rejects if `promise` takes longer than `ms` */
function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} isn't available`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** a pref from channels.prefs.get in channels.prefs.set's "type:admin,user:U123" form */
function serialize(pref: Restriction | null | undefined): string {
  const parts = [
    ...(pref?.type ?? []).map((type) => `type:${type}`),
    ...(pref?.user ?? []).map((user) => `user:${user}`),
  ];
  return parts.length ? parts.join(',') : EVERYONE;
}
