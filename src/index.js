const { resolve: resolvePath } = require('path')
const fs = require('fs')

const { app, clipboard, dialog, session, BrowserWindow, Menu, MenuItem } = require('electron')
const Store = require('electron-store')
const DiscordRPC = require('discord-rpc')
const open = require('open')


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit()
}

const store = new Store({
  defaults: {
    enableRichPresence: true
  }
})

const pxlsURL = readPxlsURL()
console.info('Pxls URL:', pxlsURL.toString())

const userextsDirPath = resolvePath(app.getAppPath(), 'userexts')
if (!fs.existsSync(userextsDirPath)) {
  fs.mkdirSync(userextsDirPath)
}

const dcClient = new DiscordRPC.Client({ transport: 'ipc' }).login({ clientId: '771579064750047252' })

const bootTime = Date.now()

const DISCORD_PRESENCE = {
  state: 'Placing pixels',
  startTimestamp: bootTime,
  largeImageKey: 'logo',
  instance: true
}

/**
 * @type BrowserWindow
 */
let mainWindow
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    icon: resolvePath(__dirname, './favicon.ico')
  })

  mainWindow.webContents.on('new-window', (e, urlStr) => {
    const url = new URL(urlStr)
    if (url.host === pxlsURL.host) {
      return
    }
    e.preventDefault()
    open(url.toString())
  })

  mainWindow.loadURL(pxlsURL.toString())
    .then(injectUserExts)

  const menu = new Menu()
  menu.append(new MenuItem({
    label: 'Rich Presence',
    submenu: [
      {
        label: 'Update',
        click: () => updateDiscordActivity(DISCORD_PRESENCE)
      },
      {
        label: 'Toggle',
        type: 'checkbox',
        checked: store.get('enableRichPresence'),
        click: (item) => {
          store.set('enableRichPresence', item.checked)
          if (item.checked) {
            updateDiscordActivity(DISCORD_PRESENCE)
          } else {
            clearDiscordActivity()
          }
        }
      }
    ]
  }))
  menu.append(new MenuItem({
    label: 'Template',
    submenu: [
      {
        label: 'Open template from clipboard',
        click: () => {
          const url = new URL(clipboard.readText())
          if (url.host !== pxlsURL.host || url.pathname !== '/') {
            return
          }

          mainWindow.webContents.loadURL(url.toString())
        }
      },
      {
        label: 'Copy URL to Clipboard',
        click: () => clipboard.writeText(mainWindow.webContents.getURL())
      }
    ]
  }))
  menu.append(new MenuItem({
    label: 'Developer',
    submenu: [
      {
        label: 'Open userexts Folder',
        click: () => open(userextsDirPath)
      },
      {
        role: 'toggleDevTools'
      }
    ]
  }))

  mainWindow.setMenu(menu)

  if (store.get('enableRichPresence')) {
    updateDiscordActivity(DISCORD_PRESENCE)
  }

  mainWindow.maximize()
  mainWindow.show()
}

function injectUserExts() {
  if (!fs.existsSync(userextsDirPath)) {
    return
  }

  for (const filename of fs.readdirSync(userextsDirPath)) {
    const path = resolvePath(userextsDirPath, filename)
    if (filename.endsWith('.css')) {
      mainWindow.webContents.insertCSS(fs.readFileSync(path, { encoding: 'utf-8' }))
      console.info('Loaded user extension css', filename)
    } else if (filename.endsWith('.js')) {
      mainWindow.webContents.executeJavaScript(fs.readFileSync(path, { encoding: 'utf-8' }), true)
      console.info('Loaded user extension js', filename)
    }
  }
}

async function updateDiscordActivity(args) {
  const client = await dcClient
  return client.setActivity(args)
    .catch((err) => {
      dialog.showMessageBox({
        type: 'error',
        title: 'Cannot update rich presence',
        message: err.toString()
      })
      return err
    })
}

async function clearDiscordActivity(args) {
  const client = await dcClient
  return client.clearActivity()
    .catch((err) => {
      dialog.showMessageBox({
        type: 'error',
        title: 'Cannot clear rich presence',
        message: err.toString()
      })
      return err
    })
}

function readPxlsURL() {
  let s
  try {
    s = fs.readFileSync(resolvePath(app.getAppPath(), './pxls-url.txt'), { encoding: 'utf-8' }).trim()
  } catch (err) {
    console.error(err)
    s = 'https://pxls.space'
  }

  return new URL(s)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Patch Google User-Agent so it lets us authenticate
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [ 'https://accounts.google.com/o/oauth2/*' ] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
