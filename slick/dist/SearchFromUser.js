// slick-plugin {"id":"SearchFromUser","name":"Search From User","description":"Adds \"Search messages\" to a member's profile menu and right-click menu, to search messages from them."}
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
  default: () => SearchFromUser
});
module.exports = __toCommonJS(index_exports);
var import_slick = require("$slick");

// meta.ts
var id = "SearchFromUser";
var pluginName = "Search From User";
var description = `Adds "Search messages" to a member's profile menu and right-click menu, to search messages from them.`;
var category = "people";
var defaultEnabled = false;
var settings = {};

// index.tsx
var KEY_PREFIX = "slick-search-from-user__";
var SearchFromUser = class extends import_slick.SlickPlugin {
  static requiredAPIs = ["redux"];
  static id = id;
  static pluginName = pluginName;
  static description = description;
  static category = category;
  static defaultEnabled = defaultEnabled;
  static settings = settings;
  /** the overflow menu knows whose profile it is; MenuFromTemplate does not */
  MemberIdContext = React.createContext(null);
  start() {
    this.api.patchComponent("RimetoMemberProfileOverflowMenu", (Original) => (props) => /* @__PURE__ */ React.createElement(this.MemberIdContext.Provider, { value: props.memberId ?? null }, /* @__PURE__ */ React.createElement(Original, { ...props })));
    this.api.patchComponent("MenuFromTemplate", (Original) => (props) => {
      const memberId = React.useContext(this.MemberIdContext);
      const template = props.template;
      if (!memberId || !Array.isArray(template) || template.some((it) => it?.key === `${KEY_PREFIX}search`))
        return /* @__PURE__ */ React.createElement(Original, { ...props });
      const files = template.findIndex((it) => typeof it?.label === "string" && /^View (your )?files$/.test(it.label));
      const item = this.searchMenuItem(memberId);
      const next = files === -1 ? [...template, { key: `${KEY_PREFIX}separator`, type: "separator" }, item] : [...template.slice(0, files + 1), item, ...template.slice(files + 1)];
      return /* @__PURE__ */ React.createElement(Original, { ...props, template: next });
    });
    this.api.redux.patchThunk(
      "getMemberContextMenuTemplate",
      (original) => (args, ...rest) => {
        const thunk = original(args, ...rest);
        return (...thunkArgs) => {
          const template = thunk(...thunkArgs);
          if (!args?.id || !Array.isArray(template)) return template;
          const separator = template.findIndex((it) => it?.type === "separator");
          const at = separator === -1 ? template.length : separator;
          return [...template.slice(0, at), this.searchMenuItem(args.id), ...template.slice(at)];
        };
      }
    );
  }
  searchMenuItem(memberId) {
    return {
      key: `${KEY_PREFIX}search`,
      label: "Search messages",
      click: () => this.searchFrom(memberId)
    };
  }
  /** runs a search for `from:@member`, with the same "From" filter Slack's own search builds */
  searchFrom(memberId) {
    const name = this.api.redux.getRawState()?.members?.[memberId]?.name || memberId;
    const label = `from:@${name}`;
    const queryOps = [
      {
        insert: label,
        attributes: {
          slacksearchfilter: {
            entityId: memberId,
            label,
            mention: true,
            modifier: "from"
          }
        }
      },
      { insert: " " }
    ];
    this.api.redux.dispatchThunk("openFromSlashCommand", { queryOps }).catch((err) => this.log("could not open search", err));
  }
};
return module.exports.default;
});

//# sourceURL=slick:///plugins/SearchFromUser.js
