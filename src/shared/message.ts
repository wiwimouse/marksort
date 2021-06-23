export type MessageItemType = 'saved';

export interface MessageItem {
  type: MessageItemType;
  payload?: any;
}
