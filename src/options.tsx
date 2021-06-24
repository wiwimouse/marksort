import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
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
        Ignore the bookmark bar, but still sort bookmarks in subfolder.
      </span>
    </label>
  );
};

const OrderField = (props: {
  compareBy: ComparisonStrategy;
  order: SortingOrder;
  onChange: (value: { compareBy: ComparisonStrategy; order: SortingOrder }) => void;
}) => {
  type SelectValue = '0' | '1' | '2' | '3' | '4' | '5';

  const { compareBy, order, onChange } = props;
  const value: SelectValue =
    compareBy === 'title' && order === 'asc'
      ? '0'
      : compareBy === 'title' && order === 'desc'
      ? '1'
      : compareBy === 'url' && order === 'asc'
      ? '2'
      : compareBy === 'url' && order === 'desc'
      ? '3'
      : compareBy === 'url_simple' && order === 'asc'
      ? '4'
      : '5';
  const onSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SelectValue;

    switch (value) {
      case '0':
        return onChange({ compareBy: 'title', order: 'asc' });
      case '1':
        return onChange({ compareBy: 'title', order: 'desc' });
      case '2':
        return onChange({ compareBy: 'url', order: 'asc' });
      case '3':
        return onChange({ compareBy: 'url', order: 'desc' });
      case '4':
        return onChange({ compareBy: 'url_simple', order: 'asc' });
      case '5':
        return onChange({ compareBy: 'url_simple', order: 'desc' });
    }
  };

  return (
    <>
      <label className="title">Order</label>
      <div className="description">
        <span>**Service**</span>
        <br />
        <span>
          The Service strategy analyze Url result in place same service together. It order bookmarks
          follow rules bellow:
        </span>
        <br />
        <span>
          protocol &rarr; domain &rarr; subdomain &rarr; port &rarr; pathname + search + hash
        </span>
        <br />
        <span>All factors are sorted in alphabetical order.</span>
        <br />
      </div>
      <select value={value} onChange={onSelectChange}>
        <option value="2">Service [A-Z]</option>
        <option value="3">Service [Z-A]</option>
        <option value="0">Title [A-Z]</option>
        <option value="1">Title [Z-A]</option>
        <option value="4">URL [A-Z]</option>
        <option value="5">URL [Z-A]</option>
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

let savedMsgTimeout: NodeJS.Timeout;

const OptionPage = () => {
  const [extOpts, setExtOpts] = useState<ExtensionOptions>(defaultOpts);
  const [showSavedMsg, setShowSavedMsg] = useState<boolean>(false);

  useEffect(() => {
    getUserOpts().then(setExtOpts);
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearTimeout(savedMsgTimeout);
    setShowSavedMsg(false);
    chrome.storage.sync.set(extOpts, () => {
      setShowSavedMsg(true);
      savedMsgTimeout = setTimeout(() => setShowSavedMsg(false), 1000);
      const messageItem: MessageItem = { type: 'saved' };
      chrome.runtime.sendMessage(messageItem);
    });
  };

  const { auto, compareBy, order, folderIgnore, folderPlacement } = extOpts;

  return (
    <div>
      <form onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0 }}>Marksort</h2>

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

ReactDOM.render(
  <React.StrictMode>
    <OptionPage />
  </React.StrictMode>,
  document.getElementById('root'),
);
