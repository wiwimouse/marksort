export type SortingOrder = 'asc' | 'desc';
export type ComparisonStrategy = 'title' | 'url' | 'url_simple';
export type FolderPlacement = 'top' | 'bottom';

export interface ExtensionOptions {
  auto: boolean;
  order: SortingOrder;
  compareBy: ComparisonStrategy;
  folderPlacement: FolderPlacement;
  folderIgnore: string[];
}

export const bookmarkBarNodeId = '1';

export const defaultOpts: ExtensionOptions = {
  auto: false,
  order: 'asc',
  compareBy: 'url',
  folderPlacement: 'top',
  folderIgnore: [bookmarkBarNodeId],
};

export async function getUserOpts(): Promise<ExtensionOptions> {
  return new Promise<ExtensionOptions>((resolve) => {
    chrome.storage.sync.get(defaultOpts, items => {
      resolve(items as ExtensionOptions)
    })
  })
}
