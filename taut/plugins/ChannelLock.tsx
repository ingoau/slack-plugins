// Adds "Lock channel" to the right-click menu of channels you manage, so only admins can post and threads are off

import { type MenuTemplateItem, TautPlugin } from '$taut'

/** a posting pref as channels.prefs.get returns it */
type Restriction = { type?: string[]; user?: string[] }
/** what a lock replaced, as channels.prefs.set takes it */
type SavedPrefs = { who_can_post: string; can_thread: string }
type Channel = { is_org_shared?: boolean }
type Member = { is_admin?: boolean; is_owner?: boolean }
type OptionsToShow = (
  state: unknown,
  channelId: string
) => { postingPermissions?: { shouldShow?: boolean; disabled?: boolean } }

/** Slack's "Everyone" posting setting, which is also what an unset pref means */
const EVERYONE = 'type:ra'
/** how long to wait for Slack's pieces where they're used */
const ACTION_WAIT_MS = 10_000

export default class ChannelLock extends TautPlugin<typeof ChannelLock> {
  static readonly id = 'ChannelLock'
  static readonly pluginName = 'Channel Lock'
  static readonly description =
    'Adds "Lock channel" to the right-click menu of channels you manage, so only admins can post and threads are off'
  static readonly authors = [
    { name: 'Ingo Wolf', url: 'https://github.com/ingoau' },
  ]
  static readonly category = 'app'
  static readonly defaultConfig = {
    enabled: false,
  }

  /** channel id -> its posting prefs from before it was locked */
  private locks = this.api.storage.store<Record<string, SavedPrefs>>(
    'locks',
    {}
  )
  /** Slack's selector for which channel settings you can change, set once it loads */
  private optionsToShow: OptionsToShow | undefined
  private readonly thunks = {
    getChannelPrefFetcher: this.api.redux.waitForThunkCreator(
      'getChannelPrefFetcher'
    ),
    setChannelPrefsByAPIAndUpdateStore: this.api.redux.waitForThunkCreator(
      'setChannelPrefsByAPIAndUpdateStore'
    ),
  }
  /** channels with a lock or unlock in flight */
  private busy = new Set<string>()

  async start() {
    this.api
      .waitForExport<OptionsToShow>(this.api.byName('additionalOptionsToShow'))
      .then((fn) => {
        this.optionsToShow = fn
      })
    await this.locks.ready
    if (this.api.signal.aborted) return

    // the right-click menu on a channel's sidebar row, header or link
    this.api.redux.patchThunk(
      'getContextMenuTemplate',
      (original) =>
        (args: { id?: string }, ...rest: unknown[]) => {
          const thunk = original(args, ...rest)
          return (
            dispatch: (action: unknown) => unknown,
            getState: () => any,
            ...more: unknown[]
          ) => {
            const template: MenuTemplateItem[] = thunk(
              dispatch,
              getState,
              ...more
            )
            const channelId = args?.id
            if (!channelId || !this.canManage(getState(), channelId))
              return template
            const locked = !!this.locks.get()[channelId]
            return [
              ...template,
              { key: 'taut-channel-lock__separator', type: 'separator' },
              {
                key: locked
                  ? 'taut-channel-lock__unlock'
                  : 'taut-channel-lock__lock',
                label: locked ? 'Unlock channel' : 'Lock channel',
                click: () =>
                  locked ? this.unlock(channelId) : this.lock(channelId),
              },
            ]
          }
        }
    )
  }

  /** whether Slack would let you change this channel's posting permissions */
  private canManage(state: unknown, channelId: string): boolean {
    try {
      const option = this.optionsToShow?.(state, channelId)?.postingPermissions
      return !!option?.shouldShow && !option.disabled
    } catch (err) {
      this.log('could not check permissions for', channelId, err)
      return false
    }
  }

  private async lock(channelId: string) {
    if (this.busy.has(channelId)) return
    this.busy.add(channelId)
    try {
      const [whoCanPost, canThread] = await Promise.all([
        this.getPref(channelId, 'who_can_post'),
        this.getPref(channelId, 'can_thread'),
      ])
      const previous: SavedPrefs = {
        who_can_post: serialize(whoCanPost),
        can_thread: serialize(canThread),
      }
      // saved first, so a lock that half-applies can still be undone
      await this.locks.update((saved) => ({
        ...saved,
        [channelId]: saved[channelId] ?? previous,
      }))
      const adminsOnly = this.adminsOnly(channelId)
      // can_thread matching who_can_post is Slack's "Allow threads" turned off
      await this.setPrefs(channelId, {
        who_can_post: adminsOnly,
        can_thread: adminsOnly,
      })
      this.log('locked', channelId, 'was', previous)
    } catch (err) {
      this.fail('lock', channelId, err)
    } finally {
      this.busy.delete(channelId)
    }
  }

  private async unlock(channelId: string) {
    const previous = this.locks.get()[channelId]
    if (!previous || this.busy.has(channelId)) return
    this.busy.add(channelId)
    try {
      await this.setPrefs(channelId, previous)
      await this.locks.update((saved) => {
        const { [channelId]: _, ...rest } = saved
        return rest
      })
      this.log('unlocked', channelId, 'to', previous)
    } catch (err) {
      this.fail('unlock', channelId, err)
    } finally {
      this.busy.delete(channelId)
    }
  }

  /** "Admins only" as Slack's posting permissions dialog saves it, which keeps you able to post if you aren't one */
  private adminsOnly(channelId: string): string {
    const state = this.api.redux.getRawState()
    const me = this.api.members.getCurrentMemberId()
    const channel: Channel | undefined = state?.channels?.[channelId]
    const member: Member | undefined = me ? state?.members?.[me] : undefined
    const type = channel?.is_org_shared ? 'type:org_admin' : 'type:admin'
    const isAdmin = member?.is_admin || member?.is_owner
    return isAdmin || !me ? type : `${type},user:${me}`
  }

  private async getPref(
    channelId: string,
    prefName: string
  ): Promise<Restriction | null | undefined> {
    const res = (await this.dispatch('getChannelPrefFetcher', {
      channelId,
      prefName,
      reason: 'taut-channel-lock',
    })) as { pref_value?: Restriction | null }
    return res?.pref_value
  }

  /** channels.prefs.set through Slack, which also updates its copy of the prefs */
  private setPrefs(channelId: string, prefs: SavedPrefs) {
    return this.dispatch('setChannelPrefsByAPIAndUpdateStore', {
      channelId,
      newPrefs: JSON.stringify(prefs),
      reason: 'taut-channel-lock',
    })
  }

  /** dispatches one of `thunks`, failing if Slack doesn't have it in time */
  private async dispatch(name: keyof ChannelLock['thunks'], args: object) {
    const create = await this.api.within(
      this.thunks[name],
      ACTION_WAIT_MS,
      `Slack's ${name} action`
    )
    // a user action, so the store exists by now
    const store = this.api.redux.getStore()
    if (!create || !store)
      throw new Error(`Slack's ${name} action isn't available`)
    return store.dispatch(create(args))
  }

  private fail(action: 'lock' | 'unlock', channelId: string, err: unknown) {
    this.log(`could not ${action}`, channelId, err)
    if (this.api.signal.aborted) return
    this.api.modal.alert({
      title: `Couldn't ${action} the channel`,
      body: err instanceof Error ? err.message : String(err),
    })
  }
}

/** a pref from channels.prefs.get in channels.prefs.set's "type:admin,user:U123" form */
function serialize(pref: Restriction | null | undefined): string {
  const parts = [
    ...(pref?.type ?? []).map((type) => `type:${type}`),
    ...(pref?.user ?? []).map((user) => `user:${user}`),
  ]
  return parts.length ? parts.join(',') : EVERYONE
}
