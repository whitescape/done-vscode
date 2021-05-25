const BASE_URL = `https://done-be-stage.herokuapp.com`,
	BASE_WS = `wss://done-be-stage.herokuapp.com`

const vscode = require('vscode'),
	wsc = require('socket.io-client')(BASE_URL, {
		transports: [ "websocket" ],
		autoConnect: false,
		withCredentials: true,
	}),
	Path = require('path'),
	{ promises: fs } = require('fs'),
	{ promisify } = require('util'),
	exec = promisify(require('child_process').exec)

let TOKEN = ''

const auth = async context => {
	const answer = await vscode.window.showInformationMessage(
		`Press OK to proceed auth in your default webbrowser`,
		'OK', 'Cancel',
	)
	if ('OK' != answer) return null

	const urlCallback = await vscode.env.asExternalUri(vscode.Uri.parse(`${vscode.env.uriScheme}://whitescape-done.hitman`))
	const url = vscode.Uri.parse(`${BASE_URL}/auth/vscode/signin/?state=${urlCallback.toString(true)}`) // == encodeURIComponent
	vscode.env.openExternal(url)
}

const barrel = []
let isAimed = false

const load = bullet => {
	barrel.push(bullet)
	if (!isAimed) shoot().catch(console.error)
}

const gitOriginsPaths = []

const getGitOrigin = async path => {
	const exists = gitOriginsPaths.find(go => go.path == path)
	if (exists) return exists.origin
	const { stdout } = await exec(`git remote get-url origin`, { cwd: path })
	const origin = stdout
		.replace(/\n$/, '')
		.replace(/^http(s|):\/\/.*?\//, '')
		.replace(/\.git(\n|)$/, '')
	gitOriginsPaths.push({ path, origin })
	return origin
}

const shoot = async () => {
	isAimed = true
	const bullet = barrel.pop()

	// check if git
	const dirPathFull = Path.dirname(bullet.nameFile)
  let restPath = `${dirPathFull}`
  while (restPath != '/') {
    try {
      await fs.access(`${restPath}/.git/config`, fs.F_OK)
      break
    } catch (e) {
      restPath = Path.dirname(restPath)
    }
  }

	if (restPath != '/') {
		bullet.nameFile = bullet.nameFile
			.replace(restPath, '')
			.replace(/^\//, '')
		bullet.gitOrigin = await getGitOrigin(restPath)
		wsc.emit('hit', bullet)
	}

	if (barrel.length) await shoot()
	else isAimed = false
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.secrets.get('token')
		.then(_TOKEN => {
			if (_TOKEN) {
				wsc.auth = { token: TOKEN = _TOKEN }
				wsc.connect()
			} else {
				auth(context).catch(console.error)
			}
		})

	const disposable = vscode.commands.registerCommand('hitman.auth', () => auth(context))
	context.subscriptions.push(disposable)

	vscode.window.registerUriHandler({
		handleUri: async uri => {
			const matchToken = uri.query && uri.query.match(/[?&]token=(.*?)(&|$)/)
			if (!matchToken) return null
			await context.secrets.store('token', TOKEN = matchToken[1])

			wsc.auth = { token: TOKEN }
			wsc.connect()
		}
	})

	auth(context).catch(console.error)

	let atLast = new Date
	let atStart = new Date(atLast - 1)
	let nameFileLast = ''
	let nInterval

	vscode.workspace.onDidChangeTextDocument(event => {
		if (!TOKEN) return null
		if (!vscode.window.activeTextEditor || event.document != vscode.window.activeTextEditor.document) return null

		const nameFile = event.document.fileName
		atLast = new Date

		if (nameFile != nameFileLast) {
			if (nameFileLast) {
				if (nInterval) {
					nInterval = clearInterval(nInterval)
				}
				load({
					nameFile: nameFileLast,
					atStart: atStart.toISOString(),
					atLast: atLast.toISOString(),
				})
			}
			nameFileLast = `${nameFile}`
			atStart = new Date(atLast - 1)
			nInterval = setInterval(() => {
				if ((new Date - atLast) > 2000) {
					if (nInterval) {
						nInterval = clearInterval(nInterval)
						load({
							nameFile: nameFileLast,
							atStart: atStart.toISOString(),
							atLast: atLast.toISOString()
						})
						nameFileLast = ''
					}
				}
			}, 100)
		}
	}, null, context.subscriptions)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
