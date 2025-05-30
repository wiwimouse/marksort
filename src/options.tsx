import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageItem } from './shared/message';
import {
  SortingOrder,
  ComparisonStrategy,
  FolderPlacement,
  ExtensionOptions,
  defaultOpts,
  bookmarkBarNodeId,
  getUserOpts,
} from './shared/config';

const AutoSortField = (props: { auto: boolean; onChange: (auto: boolean) => void }) => {
  const { auto, onChange } = props;

  return (
    <label>
      <input type="checkbox" checked={auto} onChange={(e) => onChange(e.target.checked)} />
      <span>Auto sort bookmarks</span>
    </label>
  );
};

const BookmarkBarField = (props: {
  folderIgnore: string[];
  onChange: (value: string[]) => void;
}) => {
  const { folderIgnore, onChange } = props;
  const isIgnoreBookmarkBar = folderIgnore.findIndex((id) => id === bookmarkBarNodeId) !== -1;
  const onCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let folderIgnoreCopy = folderIgnore.slice();

    if (e.target.checked) {
      folderIgnoreCopy = folderIgnore.concat([bookmarkBarNodeId]);
    } else {
      const idx = folderIgnore.findIndex((id) => id === bookmarkBarNodeId);
      folderIgnoreCopy.splice(idx, 1);
    }

    onChange(folderIgnoreCopy);
  };

  return (
    <label>
      <input type="checkbox" checked={isIgnoreBookmarkBar} onChange={onCheckboxChange} />
      <span>Ignore bookmark bar</span>
      <br />
      <span className="description">
        Ignores the bookmark bar, but still sorts bookmarks within its subfolders.
      </span>
    </label>
  );
};

type SelectValue = '0' | '1' | '2' | '3' | '4' | '5';

const orderOptions: {
  value: SelectValue;
  label: string;
  compareBy: ComparisonStrategy;
  order: SortingOrder;
  group: string;
}[] = [
  { value: '2', label: 'Service [A-Z]', compareBy: 'url', order: 'asc', group: 'Service' },
  { value: '3', label: 'Service [Z-A]', compareBy: 'url', order: 'desc', group: 'Service' },
  { value: '0', label: 'Title [A-Z]', compareBy: 'title', order: 'asc', group: 'Title' },
  { value: '1', label: 'Title [Z-A]', compareBy: 'title', order: 'desc', group: 'Title' },
  { value: '4', label: 'URL [A-Z]', compareBy: 'url_simple', order: 'asc', group: 'URL' },
  { value: '5', label: 'URL [Z-A]', compareBy: 'url_simple', order: 'desc', group: 'URL' },
];

// Helper to create a key from compareBy and order
function getOrderKey(compareBy: ComparisonStrategy, order: SortingOrder) {
  return `${compareBy}-${order}`;
}

// Generate valueMap from orderOptions using reduce
const valueMap: Record<string, SelectValue> = orderOptions.reduce(
  (acc, opt) => {
    acc[getOrderKey(opt.compareBy, opt.order)] = opt.value;
    return acc;
  },
  {} as Record<string, SelectValue>,
);

// Build a lookup object for direct access (outside the component)
const orderOptionMap = orderOptions.reduce(
  (acc, opt) => {
    acc[opt.value] = opt;
    return acc;
  },
  {} as Record<SelectValue, (typeof orderOptions)[number]>,
);

const OrderField = (props: {
  compareBy: ComparisonStrategy;
  order: SortingOrder;
  onChange: (value: { compareBy: ComparisonStrategy; order: SortingOrder }) => void;
}) => {
  const { compareBy, order, onChange } = props;
  // Use valueMap generated from orderOptions
  const value: SelectValue = valueMap[getOrderKey(compareBy, order)] || '0';

  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = orderOptionMap[e.target.value as SelectValue];
    if (selected) {
      onChange({ compareBy: selected.compareBy, order: selected.order });
    }
  };

  return (
    <>
      <label className="title" htmlFor="order-select">
        Order
      </label>
      <div className="description">
        <strong>Service</strong>
        <br />
        <span>
          The Service strategy groups bookmarks by service, sorting them based on the following
          order:
        </span>
        <br />
        <span><i>{'protocol --> domain --> subdomain --> port --> path'}</i></span>
        <br />
        <span>Each component is sorted alphabetically.</span>
        <br />
      </div>
      <select id="order-select" style={{ marginTop: '0.5em' }} value={value} onChange={onSelectChange}>
        {orderOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </>
  );
};

const FolderPlacementField = (props: {
  folderPlacement: FolderPlacement;
  onChange: (value: FolderPlacement) => void;
}) => {
  const { folderPlacement, onChange } = props;

  return (
    <p>
      <span className="title">Folder placement</span>
      <br />
      <label>
        <input type="radio" checked={folderPlacement === 'top'} onChange={() => onChange('top')} />
        <span>Top</span>
      </label>
      <label>
        <input
          type="radio"
          checked={folderPlacement === 'bottom'}
          onChange={() => onChange('bottom')}
        />
        <span>Bottom</span>
      </label>
    </p>
  );
};

const OptionPage = () => {
  const [extOpts, setExtOpts] = useState<ExtensionOptions>(defaultOpts);
  const [showSavedMsg, setShowSavedMsg] = useState<boolean>(false);
  const savedMsgTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    getUserOpts().then(setExtOpts);
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearTimeout(savedMsgTimeout.current);
    setShowSavedMsg(false);
    chrome.storage.sync.set(extOpts, () => {
      setShowSavedMsg(true);
      savedMsgTimeout.current = setTimeout(() => setShowSavedMsg(false), 1000);
      const messageItem: MessageItem = { type: 'saved' };
      chrome.runtime.sendMessage(messageItem);
    });
  };

  const { auto, compareBy, order, folderIgnore, folderPlacement } = extOpts;

  return (
    <div>
      <form onSubmit={onSubmit}>
        <AutoSortField
          auto={auto}
          onChange={(auto) => setExtOpts((state) => ({ ...state, auto }))}
        />

        <BookmarkBarField
          folderIgnore={folderIgnore}
          onChange={(folderIgnore) => setExtOpts((state) => ({ ...state, folderIgnore }))}
        />

        <OrderField
          compareBy={compareBy}
          order={order}
          onChange={({ compareBy, order }) =>
            setExtOpts((state) => ({ ...state, compareBy, order }))
          }
        />

        <FolderPlacementField
          folderPlacement={folderPlacement}
          onChange={(folderPlacement) => setExtOpts((state) => ({ ...state, folderPlacement }))}
        />

        <button>save</button>
        {showSavedMsg && <span className="saved-msg">Saved !</span>}
      </form>
    </div>
  );
};

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <OptionPage />
    </React.StrictMode>,
  );
}
