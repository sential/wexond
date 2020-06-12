import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

import { BoomarksService } from './bookmarks';
import { getPath } from '~/utils/paths';
import { IStorageResponse } from '~/interfaces';

export class StorageService extends EventEmitter {
  public static instance = new StorageService();

  public worker: Worker;

  public bookmarks: BoomarksService;

  public start() {
    console.log('Storage service is running.');

    this.worker = new Worker('./build/storage.bundle.js', {
      workerData: { storagePath: getPath('storage') },
    });

    this.worker.on('message', this.onMessage);

    this.bookmarks = new BoomarksService();
    this.bookmarks.start();
  }

  private onMessage = (e: IStorageResponse) => {
    if (e.action === 'receiver') {
      this[e.scope].emit(e.eventName, ...e.data);
    }
  };
}