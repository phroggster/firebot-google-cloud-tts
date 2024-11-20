interface RenderWindow {
  webContents: {
    send: (channel: string, ...args: unknown[]) => void,
  },
}

/** The path to the scripts folder inside the user's Firebot profile folder. */
declare const SCRIPTS_DIR: string;

/** The main Firebot render window. */
declare const renderWindow: RenderWindow;
