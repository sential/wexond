import { app, ipcMain, session, screen } from 'electron';
import { isAbsolute, extname } from 'path';
import { existsSync } from 'fs';
import { checkFiles } from '~/utils/files';
import { isURL, prefixHttp } from '~/utils';
import { WindowsService } from './windows-service';
import { StorageService } from './services/storage';
import { requestAuth } from './dialogs/auth';
import { protocols } from './protocols';
import { Tabs } from './tabs';
import { BrowserContext } from './browser-context';
import { extensions } from './extensions';
import { getOverlayWindow } from './extensions/api/overlay-private';

const contains = (regions: number[][], x: number, y: number) => {
  for (const region of regions) {
    if (
      x >= region[0] &&
      y >= region[1] &&
      x <= region[0] + region[2] &&
      y <= region[1] + region[3]
    ) {
      return true;
    }
  }

  return false;
};

export class Application {
  public static instance = new Application();

  public windows: WindowsService = new WindowsService();

  // public settings = new Settings();
  public tabs = new Tabs();

  public start() {
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      app.quit();
      return;
    } else {
      app.on('second-instance', async (e, argv) => {
        const path = argv[argv.length - 1];

        if (isAbsolute(path) && existsSync(path)) {
          if (process.env.NODE_ENV !== 'development') {
            const path = argv[argv.length - 1];
            const ext = extname(path);

            if (ext === '.html') {
              this.windows.current.viewManager.create({
                url: `file:///${path}`,
                active: true,
              });
            }
          }
          return;
        } else if (isURL(path)) {
          this.windows.current.viewManager.create({
            url: prefixHttp(path),
            active: true,
          });
          return;
        }

        this.windows.open();
      });
    }

    app.on('login', async (e, webContents, request, authInfo, callback) => {
      e.preventDefault();

      const window = this.windows.findByBrowserView(webContents.id);
      const credentials = await requestAuth(
        window.win,
        request.url,
        webContents.id,
      );

      if (credentials) {
        callback(credentials.username, credentials.password);
      }
    });

    protocols.forEach((protocol) => protocol?.setPrivileged?.());

    ipcMain.on('create-window', (e, incognito = false) => {
      this.windows.open(incognito);
    });

    this.onReady();
  }

  private async onReady() {
    await app.whenReady();

    checkFiles();

    StorageService.instance.start();

    // worker.on('message', (e) => {
    //   Application.instance.windows.list[0].webContents.send('main-message', e);
    // });

    // this.storage.run();
    // this.dialogs.run();

    const browserContext = await BrowserContext.from(
      session.defaultSession,
      false,
    );

    //this.storage.run();

    await browserContext.loadExtensions();

    if (process.platform === 'linux') {
      setTimeout(() => {
        this.windows.create(browserContext, {});
      }, 1000);
    } else {
      this.windows.create(browserContext, {});
    }

    ipcMain.on('mouse-move', (e) => {
      const { x, y } = screen.getCursorScreenPoint();

      const overlayWindow = getOverlayWindow(e.sender);
      const pos = overlayWindow.contentBounds;

      extensions.overlayPrivate.setIgnoreMouseEvents(
        { sender: e.sender },
        {
          flag: !contains(
            extensions.overlayPrivate.regions,
            x - pos.x,
            y - pos.y,
          ),
        },
      );
    });

    // const window = Application.instance.windows.list[0].webContents;

    // window.on('dom-ready', () => {
    //   worker.postMessage({
    //     id: 'test',
    //     scope: 'bookmarks',
    //     method: 'get-subtree',
    //     args: ['1'],
    //   } as IStorageMessage);
    // });

    // Menu.setApplicationMenu(getMainMenu());
    // runAutoUpdaterService();

    app.on('activate', () => {
      if (this.windows.list.filter((x) => x !== null).length === 0) {
        this.windows.open();
      }
    });
  }
}