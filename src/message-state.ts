import type { ChatMessage } from './types';

export const mergeMessages = (a: ChatMessage[], b: ChatMessage[]): ChatMessage[] =>
  [...new Map([...a, ...b].map(message => [message.id, message])).values()].sort((x, y) => x.seq - y.seq);

export function refreshHistory(cached: ChatMessage[], latestPage: ChatMessage[]): ChatMessage[] {
  // Old cached pages can be separated from this page by messages missed while offline.
  // Start pagination at the new contiguous page; preserve only events newer than its query.
  const newest = latestPage.at(-1)?.seq ?? 0;
  return mergeMessages(latestPage, cached.filter(message => message.seq > newest));
}
