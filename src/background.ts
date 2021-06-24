import psl from 'psl';
import { MessageItem } from './shared/message';
import { ExtensionOptions, ComparisonStrategy, SortingOrder, getUserOpts } from './shared/config';

type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

const rootNodeId = '0';
const comparisonAlgo: Record<
  ComparisonStrategy,
  (a: BookmarkTreeNode, b: BookmarkTreeNode, order: SortingOrder) => number
> = {
  title: compareByTitle,
  url: compareByUrl,
  url_simple: compareByUrlSimple,
};

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

function compareByTitle(a: BookmarkTreeNode, b: BookmarkTreeNode, order: SortingOrder): number {
  const direction = order === 'asc' ? 1 : -1;
  return a.title.localeCompare(b.title) * direction;
}

function compareByUrlSimple(a: BookmarkTreeNode, b: BookmarkTreeNode, order: SortingOrder): number {
  const direction = order === 'asc' ? 1 : -1;
  const { url: urlA = '' } = a;
  const { url: urlB = '' } = b;
  return urlA.localeCompare(urlB) * direction;
}

function groupBookmarkTreeNodes(nodes: BookmarkTreeNode[]) {
  type BookmarkTreeNodeGroup = Record<'folders' | 'marks', BookmarkTreeNode[]>;
  return nodes.reduce<BookmarkTreeNodeGroup>(
    (r, c) => {
      c.children ? r.folders.push(c) : r.marks.push(c);
      return r;
    },
    { folders: [], marks: [] },
  );
}

function sortBookmarkTreeNodes(
  nodes: BookmarkTreeNode[],
  ctx: {
    pid: string;
    extensionOpts: ExtensionOptions;
    folderIgnoreSet: Set<string>;
  },
) {
  let tasks: Promise<unknown>[] = [];
  const { pid, folderIgnoreSet, extensionOpts } = ctx;
  const { folderPlacement, compareBy, order } = extensionOpts;
  const { folders, marks } = groupBookmarkTreeNodes(nodes);

  folders.forEach((folder) => {
    const { children = [], id: pid } = folder;
    const subTasks = sortBookmarkTreeNodes(children, { ...ctx, pid });
    tasks = tasks.concat(subTasks);
  });

  if (pid === rootNodeId || folderIgnoreSet.has(pid)) return tasks;

  const marksAlgo = comparisonAlgo[compareBy];
  const foldersSorted = folders.sort((a, b) => compareByTitle(a, b, order));
  const marksSorted = marks.sort((a, b) => marksAlgo(a, b, order));
  const nodesSorted =
    folderPlacement === 'top'
      ? foldersSorted.concat(marksSorted)
      : marksSorted.concat(foldersSorted);

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

let finishingIndicatorTimeout: NodeJS.Timeout;
let extensionState: 'sorting' | 'idle' = 'idle';

function sortBookmark() {
  if (extensionState === 'sorting') return;

  extensionState = 'sorting';
  clearTimeout(finishingIndicatorTimeout);
  chrome.browserAction.setBadgeText({ text: '...' });

  chrome.bookmarks.getTree(async (tree) => {
    const root = tree[0];
    const extensionOpts = await getUserOpts();
    const tasks = sortBookmarkTreeNodes(root.children!, {
      pid: root.id,
      extensionOpts,
      folderIgnoreSet: new Set(extensionOpts.folderIgnore),
    });

    Promise.all(tasks).then(() => {
      extensionState = 'idle';
      chrome.browserAction.setBadgeText({ text: 'Done' });
      finishingIndicatorTimeout = setTimeout(() => {
        chrome.browserAction.setBadgeText({ text: '' });
      }, 1000);
    });
  });
}

async function autoSortBookmark() {
  const { auto } = await getUserOpts();
  if (auto) sortBookmark();
}

chrome.bookmarks.onCreated.addListener(autoSortBookmark);
chrome.bookmarks.onRemoved.addListener(autoSortBookmark);
chrome.bookmarks.onChanged.addListener(autoSortBookmark);
chrome.bookmarks.onMoved.addListener(autoSortBookmark);
chrome.bookmarks.onChildrenReordered.addListener(autoSortBookmark);
chrome.bookmarks.onImportEnded.addListener(autoSortBookmark);
chrome.browserAction.onClicked.addListener(sortBookmark);
chrome.runtime.onMessage.addListener((message: MessageItem) => {
  if (message.type === 'saved') sortBookmark();
});
