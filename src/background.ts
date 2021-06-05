import psl from 'psl';

type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
type SortingOrder = 'asc' | 'desc';
type ComparisonStrategy = 'title' | 'url' | 'url_simple';
interface ExtensionOptions {
  auto: boolean;
  order: SortingOrder;
  compareBy: ComparisonStrategy;
  folderPlacement: 'top' | 'bottom';
}

const rootNodeId = '0';
const comparisonAlgo: Record<
  ComparisonStrategy,
  (a: BookmarkTreeNode, b: BookmarkTreeNode, order: SortingOrder) => number
> = {
  title: compareByText,
  url: compareByUrl,
  url_simple: compareByText,
};

function getUserOpts(): Partial<ExtensionOptions> {
  if (localStorage.opts) {
    try {
      return JSON.parse(localStorage.opts);
    } catch (err) {
      return {};
    }
  } else {
    return {};
  }
}

function getUrlFactor(bn: BookmarkTreeNode) {
  try {
    const { protocol, hostname, port, pathname, search, hash } = new URL(bn.url || '');
    const parsedDomain = psl.parse(hostname);

    if (parsedDomain.error) return null;

    const { domain, subdomain } = parsedDomain;
    const protocolUnified = protocol === 'http:' ? 'https:' : protocol;
    const subdomainReversed = subdomain?.split('.').reverse().join('.') || '';

    return {
      f1: protocolUnified,
      f2: domain || '',
      f3: subdomainReversed,
      f4: Number(port),
      f5: pathname + search + hash,
    };
  } catch (err) {
    return null;
  }
}

function compareByUrl(a: BookmarkTreeNode, b: BookmarkTreeNode, order: SortingOrder) {
  const af = getUrlFactor(a);
  const bf = getUrlFactor(b);
  const direction = order === 'asc' ? 1 : -1;

  if (!af && !bf) return 0;

  if (!af) return 1;

  if (!bf) return -1;

  return (
    (af.f1.localeCompare(bf.f1) ||
      af.f2.localeCompare(bf.f2) ||
      af.f3.localeCompare(bf.f3) ||
      af.f4 - bf.f4 ||
      af.f5.localeCompare(bf.f5)) * direction
  );
}

function compareByText(a: BookmarkTreeNode, b: BookmarkTreeNode, order: SortingOrder): number {
  return a.title.localeCompare(b.title);
}

function sortBookmarkTreeNodes(nodes: BookmarkTreeNode[], pid: string, opts: ExtensionOptions) {
  let tasks: Promise<unknown>[] = [];
  const { folderPlacement, compareBy, order } = opts;
  const { folders, marks } = nodes.reduce<Record<'folders' | 'marks', BookmarkTreeNode[]>>(
    (r, c) => {
      c.children ? r.folders.push(c) : r.marks.push(c);
      return r;
    },
    { folders: [], marks: [] },
  );

  folders.forEach((folder) => {
    const subTasks = sortBookmarkTreeNodes(folder.children!, folder.id, opts);
    tasks = tasks.concat(subTasks);
  });

  if (pid === rootNodeId) return tasks;

  const marksAlgo = comparisonAlgo[compareBy];
  const foldersSorted = folders.sort((a, b) => compareByText(a, b, order));
  const marksSorted = marks.sort((a, b) => marksAlgo(a, b, order));
  const nodesSorted = folderPlacement === 'top' ? foldersSorted.concat(marksSorted) : marksSorted.concat(foldersSorted);

  tasks = tasks.concat(
    nodesSorted.map(
      (node, index) =>
        new Promise((resolve) => {
          chrome.bookmarks.move(node.id, { index }, resolve);
        }),
    ),
  );

  return tasks;
}

const defaultOpts: ExtensionOptions = {
  auto: false,
  order: 'asc',
  compareBy: 'url',
  folderPlacement: 'top',
};
let finishingIndicatorTimeout: NodeJS.Timeout;
let extensionState: 'sorting' | 'idle' = 'idle';

function sortBookmark() {
  console.log('sortBookmark');
  if (extensionState === 'sorting') return;

  extensionState = 'sorting';
  clearTimeout(finishingIndicatorTimeout);
  chrome.browserAction.setBadgeText({ text: '...' });

  const userOpts: Partial<ExtensionOptions> = getUserOpts();
  const extensionOpts = { ...defaultOpts, ...userOpts };

  chrome.bookmarks.getTree((tree) => {
    const root = tree[0];
    const tasks = sortBookmarkTreeNodes(root.children!, root.id, extensionOpts);
    Promise.all(tasks).then(() => {
      extensionState = 'idle';
      chrome.browserAction.setBadgeText({ text: 'Done' });
      finishingIndicatorTimeout = setTimeout(() => {
        chrome.browserAction.setBadgeText({ text: extensionOpts.auto ? 'Auto' : '' });
      }, 1000);
    });
  });
}

chrome.browserAction.onClicked.addListener(sortBookmark);
chrome.runtime.onStartup.addListener(() => {
  console.log('start up');
});
chrome.runtime.onSuspend.addListener(() => {
  console.log('suspend');
});
