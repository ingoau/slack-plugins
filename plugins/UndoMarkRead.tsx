// Press Ctrl+Z (Cmd+Z on Mac) in Unreads to undo the last channel you marked read

import { TautPlugin } from '$taut'

type UnreadsFrame = {
  channelId?: string
  start?: string
  initialLastRead?: string
  markedMsgCount?: number
}
type MarkArgs = {
  channelId?: string
  ts?: string
  markedMsgCount?: number
  reason?: string
}
type UnreadsListInstance = {
  markChannelLastRead(args: MarkArgs): void
  setState(update: () => { keyToFocus: string }): void
  layout?: { setAnchor?(key: string, offset: number): void }
  list?: { current?: { focusOnKey?(key: string): unknown } | null }
  defaultActiveItemForKeyboardMarking?: string
}
type UnreadsListProps = {
  frames?: UnreadsFrame[]
  markChannelLastRead?: (args: MarkArgs) => void
  ref?: React.Ref<UnreadsListInstance>
}
type MountedList = {
  instance: UnreadsListInstance
  frames: () => UnreadsFrame[] | undefined
}

/** the reason Slack's own Undo button marks with */
const UNDO_REASON = 'back'

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
    )
  )
}

export default class UndoMarkRead extends TautPlugin<typeof UndoMarkRead> {
  static readonly id = 'UndoMarkRead'
  static readonly pluginName = 'Undo Mark Read'
  static readonly description =
    'Press Ctrl+Z (Cmd+Z on Mac) in Unreads to undo the last channel you marked read'
  static readonly authors = [
    { name: 'Ingo Wolf', url: 'https://github.com/ingoau' },
  ]
  static readonly category = 'messages'
  static readonly defaultConfig = {
    enabled: false,
  }

  /** the Unreads list on screen */
  private list: MountedList | null = null
  /** channel ids marked read in it, oldest first */
  private marked: string[] = []

  start(): void {
    this.api.patchComponent<UnreadsListProps>(
      'UnreadsList',
      (Original) => (props) => {
        const latest = React.useRef(props)
        latest.current = props

        // the "Mark as read" button, its keyboard shortcuts and Undo all go through here
        const markChannelLastRead = React.useCallback((args: MarkArgs) => {
          this.noteMark(args)
          return latest.current.markChannelLastRead?.(args)
        }, [])

        const mounted = React.useRef<MountedList | null>(null)
        const outerRef = props.ref
        const ref = React.useCallback(
          (instance: UnreadsListInstance | null) => {
            if (instance) {
              mounted.current = {
                instance,
                frames: () => latest.current.frames,
              }
              this.list = mounted.current
            } else {
              if (this.list === mounted.current) this.list = null
              mounted.current = null
            }
            if (typeof outerRef === 'function') outerRef(instance)
            else if (outerRef) outerRef.current = instance
          },
          [outerRef]
        )

        return (
          <Original
            {...props}
            ref={ref}
            markChannelLastRead={markChannelLastRead}
          />
        )
      }
    )

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'z' ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        isEditable(event.target)
      )
        return
      if (!this.undoLast()) return
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    this.api.signal.addEventListener('abort', () =>
      window.removeEventListener('keydown', onKeyDown, true)
    )

    this.log('Started')
  }

  private noteMark({ channelId, markedMsgCount, reason }: MarkArgs) {
    if (!channelId) return
    this.marked = this.marked.filter((id) => id !== channelId)
    if (markedMsgCount && !reason) this.marked.push(channelId)
  }

  /** does what the latest channel's Undo button does, false if there's nothing to undo */
  private undoLast(): boolean {
    const list = this.list
    if (!list) return false
    const frames = list.frames() ?? []
    while (this.marked.length) {
      const channelId = this.marked.pop()
      const frame = frames.find((it) => it.channelId === channelId)
      // gone from the list, refreshed, or already undone
      if (
        !channelId ||
        !frame?.markedMsgCount ||
        !frame.initialLastRead ||
        frame.start === frame.initialLastRead
      )
        continue
      list.instance.markChannelLastRead({
        channelId,
        ts: frame.initialLastRead,
        reason: UNDO_REASON,
      })
      this.select(list.instance, channelId)
      return true
    }
    return false
  }

  /** selects the channel's header, like Slack does with the next one after marking one read */
  private select(list: UnreadsListInstance, channelId: string) {
    const key = `header-${channelId}`
    // while scrolling, the selected channel is the one pinned at the top
    list.layout?.setAnchor?.(key, 0)
    // while using the keyboard, it's the focused one
    list.list?.current?.focusOnKey?.(key)
    list.setState(() => ({ keyToFocus: key }))
    list.defaultActiveItemForKeyboardMarking = key
  }
}
