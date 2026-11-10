// Adds "Search messages" to a member's profile menu and right-click menu, to search messages from them

import { type MenuTemplateItem, SlickPlugin } from '$slick';
import * as meta from './meta.ts';

type MenuFromTemplateProps = { template?: MenuTemplateItem[] };
type OverflowMenuProps = { memberId?: string };

const KEY_PREFIX = 'slick-search-from-user__';

export default class SearchFromUser extends SlickPlugin<typeof meta.settings> {
  static readonly requiredAPIs = ['redux'] as const;
  static readonly id = meta.id;
  static readonly pluginName = meta.pluginName;
  static readonly description = meta.description;
  static readonly category = meta.category;
  static readonly defaultEnabled = meta.defaultEnabled;
  static readonly settings = meta.settings;

  /** the overflow menu knows whose profile it is; MenuFromTemplate does not */
  private readonly MemberIdContext = React.createContext<string | null>(null);

  start() {
    // the "..." menu on a member's profile
    this.api.patchComponent<OverflowMenuProps>('RimetoMemberProfileOverflowMenu', (Original) => (props) => (
      <this.MemberIdContext.Provider value={props.memberId ?? null}>
        <Original {...props} />
      </this.MemberIdContext.Provider>
    ));

    this.api.patchComponent<MenuFromTemplateProps>('MenuFromTemplate', (Original) => (props) => {
      const memberId = React.useContext(this.MemberIdContext);
      const template = props.template;
      if (!memberId || !Array.isArray(template) || template.some((it) => it?.key === `${KEY_PREFIX}search`))
        return <Original {...props} />;
      // next to "View files" ("View your files" on your own profile)
      const files = template.findIndex((it) => typeof it?.label === 'string' && /^View (your )?files$/.test(it.label));
      const item = this.searchMenuItem(memberId);
      const next: MenuTemplateItem[] =
        files === -1
          ? [...template, { key: `${KEY_PREFIX}separator`, type: 'separator' }, item]
          : [...template.slice(0, files + 1), item, ...template.slice(files + 1)];
      return <Original {...props} template={next} />;
    });

    // the right-click menu on a member's name or avatar, after "View profile"
    this.api.redux.patchThunk(
      'getMemberContextMenuTemplate',
      (original) =>
        (args: { id?: string }, ...rest: unknown[]) => {
          const thunk = original(args, ...rest);
          return (...thunkArgs: unknown[]) => {
            const template: MenuTemplateItem[] = thunk(...thunkArgs);
            if (!args?.id || !Array.isArray(template)) return template;
            const separator = template.findIndex((it) => it?.type === 'separator');
            const at = separator === -1 ? template.length : separator;
            return [...template.slice(0, at), this.searchMenuItem(args.id), ...template.slice(at)];
          };
        },
    );
  }

  private searchMenuItem(memberId: string): MenuTemplateItem {
    return {
      key: `${KEY_PREFIX}search`,
      label: 'Search messages',
      click: () => this.searchFrom(memberId),
    };
  }

  /** runs a search for `from:@member`, with the same "From" filter Slack's own search builds */
  private searchFrom(memberId: string) {
    // the raw member, so another plugin's nickname doesn't end up in the filter
    const name: string = this.api.redux.getRawState()?.members?.[memberId]?.name || memberId;
    const label = `from:@${name}`;
    const queryOps = [
      {
        insert: label,
        attributes: {
          slacksearchfilter: {
            entityId: memberId,
            label,
            mention: true,
            modifier: 'from',
          },
        },
      },
      { insert: ' ' },
    ];
    // what /search runs, it searches right away when given a query
    this.api.redux
      .dispatchThunk('openFromSlashCommand', { queryOps })
      .catch((err) => this.log('could not open search', err));
  }
}
