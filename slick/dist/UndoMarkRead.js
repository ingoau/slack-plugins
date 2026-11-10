// slick-plugin {"id":"UndoMarkRead","name":"Undo Mark Read","description":"Press Ctrl+Z (Cmd+Z on Mac) in Unreads to undo the last channel you marked read."}
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

// index.tsx
var index_exports = {};
__export(index_exports, {
  default: () => UndoMarkRead
});
module.exports = __toCommonJS(index_exports);
var import_slick = require("$slick");

// meta.ts
var id = "UndoMarkRead";
var pluginName = "Undo Mark Read";
var description = "Press Ctrl+Z (Cmd+Z on Mac) in Unreads to undo the last channel you marked read.";
var category = "messages";
var defaultEnabled = false;
var settings = {};

// index.tsx
var UNDO_REASON = "back";
function isEditable(target) {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
var UndoMarkRead = class extends import_slick.SlickPlugin {
  static requiredAPIs = [];
  static id = id;
  static pluginName = pluginName;
  static description = description;
  static category = category;
  static defaultEnabled = defaultEnabled;
  static settings = settings;
  /** the Unreads list on screen */
  list = null;
  /** channel ids marked read in it, oldest first */
  marked = [];
  start() {
    this.api.patchComponent("UnreadsList", (Original) => (props) => {
      const latest = React.useRef(props);
      latest.current = props;
      const markChannelLastRead = React.useCallback((args) => {
        this.noteMark(args);
        return latest.current.markChannelLastRead?.(args);
      }, []);
      const mounted = React.useRef(null);
      const outerRef = props.ref;
      const ref = React.useCallback(
        (instance) => {
          if (instance) {
            mounted.current = {
              instance,
              frames: () => latest.current.frames
            };
            this.list = mounted.current;
          } else {
            if (this.list === mounted.current) this.list = null;
            mounted.current = null;
          }
          if (typeof outerRef === "function") outerRef(instance);
          else if (outerRef) outerRef.current = instance;
        },
        [outerRef]
      );
      return /* @__PURE__ */ React.createElement(Original, { ...props, ref, markChannelLastRead });
    });
    const onKeyDown = (event) => {
      if (event.key.toLowerCase() !== "z" || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || isEditable(event.target))
        return;
      if (!this.undoLast()) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, {
      capture: true,
      signal: this.api.signal
    });
  }
  noteMark({ channelId, markedMsgCount, reason }) {
    if (!channelId) return;
    this.marked = this.marked.filter((id2) => id2 !== channelId);
    if (markedMsgCount && !reason) this.marked.push(channelId);
  }
  /** does what the latest channel's Undo button does, false if there's nothing to undo */
  undoLast() {
    const list = this.list;
    if (!list) return false;
    const frames = list.frames() ?? [];
    while (this.marked.length) {
      const channelId = this.marked.pop();
      const frame = frames.find((it) => it.channelId === channelId);
      if (!channelId || !frame?.markedMsgCount || !frame.initialLastRead || frame.start === frame.initialLastRead)
        continue;
      list.instance.markChannelLastRead({
        channelId,
        ts: frame.initialLastRead,
        reason: UNDO_REASON
      });
      this.select(list.instance, channelId);
      return true;
    }
    return false;
  }
  /** selects the channel's header, like Slack does with the next one after marking one read */
  select(list, channelId) {
    const key = `header-${channelId}`;
    list.layout?.setAnchor?.(key, 0);
    list.list?.current?.focusOnKey?.(key);
    list.setState(() => ({ keyToFocus: key }));
    list.defaultActiveItemForKeyboardMarking = key;
  }
};
return module.exports.default;
});

//# sourceURL=slick:///plugins/UndoMarkRead.js
