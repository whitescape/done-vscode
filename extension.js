const vscode = require('vscode'),
	exec = require('child_process').exec

const load = ({ nameFile, atStart }) => {
	try {
		exec(`\$HOME/.hitman.sh load ${nameFile} ${atStart.toISOString()}`, {
			shell: '/bin/bash'
		})
	} catch (e) {
		console.error(e)
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let atStart = new Date
	let nameFileLast = ''

	vscode.workspace.onDidChangeTextDocument(event => {
		if (vscode.window.activeTextEditor && event.document == vscode.window.activeTextEditor.document) {
			if (event.document.fileName != nameFileLast) {
				if (nameFileLast) {
					load({ nameFile: nameFileLast, atStart })
				}
				atStart = new Date
				nameFileLast = event.document.fileName
				const nInterval = setInterval(() => {
					if (new Date - atStart > 500) {
						clearInterval(nInterval)
						load({ nameFile: nameFileLast, atStart })
						nameFileLast = ''
					}
				}, 50)
			}
		}
	}, null, context.subscriptions)
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
