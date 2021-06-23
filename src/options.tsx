import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { MessageItem } from './shared/message';
import {
  SortingOrder,
  ComparisonStrategy,
  ExtensionOptions,
  defaultOpts,
  bookmarkBarNodeId,
  getUserOpts
} from './shared/config';

const OrderSelect = (props: {
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
    <select value={value} onChange={onSelectChange}>
      <option value="0">Title [A-Z]</option>
      <option value="1">Title [Z-A]</option>
      <option value="2">URL [A-Z]</option>
      <option value="3">URL [Z-A]</option>
      <option value="4">Simple URL [A-Z]</option>
      <option value="5">Simple URL [Z-A]</option>
    </select>
  );
};

let savedMsgTimeout: NodeJS.Timeout;

const OptionPage = () => {
  const [extOpts, setExtOpts] = useState<ExtensionOptions>(defaultOpts);
  const [showSavedMsg, setShowSavedMsg] = useState<boolean>(false);

  useEffect(() => {
    getUserOpts().then(setExtOpts)
  }, []);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearTimeout(savedMsgTimeout);
    setShowSavedMsg(false);
    chrome.storage.sync.set(extOpts, () => {
      setShowSavedMsg(true);
      savedMsgTimeout = setTimeout(() => setShowSavedMsg(false), 1000);
      const messageItem: MessageItem = { type: 'saved' }
      chrome.runtime.sendMessage(messageItem);
    });
  };

  const { auto, compareBy, order, folderIgnore, folderPlacement } = extOpts;
  const isIgnoreBookmarkBar = folderIgnore.findIndex((id) => id === bookmarkBarNodeId) !== -1;

  return (
    <div>
      <form onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0 }}>Marksort</h2>

        <label>
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setExtOpts((state) => ({ ...state, auto: e.target.checked }))}
          />
          <span>Auto sort bookmarks</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={isIgnoreBookmarkBar}
            onChange={(e) => {
              setExtOpts((state) => {
                let folderIgnore = state.folderIgnore.slice();

                if (e.target.checked) {
                  folderIgnore = folderIgnore.concat([bookmarkBarNodeId]);
                } else {
                  const idx = folderIgnore.findIndex((id) => id === bookmarkBarNodeId);
                  folderIgnore.splice(idx, 1);
                }

                return { ...state, folderIgnore };
              });
            }}
          />
          <span>Ignore bookmark bar</span>
          <br />
          <span className="description">
            Do not sort bookmark bar, but still sort bookmarks in subfolder under the bookmark bar.
          </span>
        </label>

        <label className="title">Order</label>
        <div className="description">
          <span>**URL**</span>
          <br />
          <span>The URL strategy sort the bookmark follow</span>
          <br />
          <span>
            protocol &rarr; domain &rarr; subdomain &rarr; port &rarr; pathname + search +
            hash
          </span>
          <br />
          <span>All factors are sorted in alphabetical order.</span>
          <br />
          <span>**Simple URL**</span>
          <br />
          <span>Simply sorting by URL in alphabetical order.</span>
        </div>
        <OrderSelect
          compareBy={compareBy}
          order={order}
          onChange={({ compareBy, order }) =>
            setExtOpts((state) => ({ ...state, compareBy, order }))
          }
        />

        <p>
          <span className="title">Folder placement</span>
          <br />
          <label>
            <input
              type="radio"
              checked={folderPlacement === 'top'}
              onChange={() => setExtOpts((state) => ({ ...state, folderPlacement: 'top' }))}
            />
            <span>Top</span>
          </label>
          <label>
            <input
              type="radio"
              checked={folderPlacement === 'bottom'}
              onChange={() => setExtOpts((state) => ({ ...state, folderPlacement: 'bottom' }))}
            />
            <span>Bottom</span>
          </label>
        </p>

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
