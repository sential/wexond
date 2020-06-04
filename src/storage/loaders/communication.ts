import { parentPort } from 'worker_threads';

import { IStorageMessage } from '~/interfaces';
import BookmarkService from '../services/bookmark';

export default () => {
  parentPort.on('message', (message: IStorageMessage) => {
    const type = message?.type;

    console.log(type);

    if (type === 'bookmarks-get-children') {
      const res = BookmarkService.getSubTree('1');

      parentPort.postMessage(res);
    }
  });
};