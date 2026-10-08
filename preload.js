'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
	openPath: p => ipcRenderer.invoke('open-path', p),
	version: () => ipcRenderer.invoke('app-version'),
	openExternal: url => ipcRenderer.invoke('open-external', url),
	onUpdate: cb => {
		ipcRenderer.on('update-ready', (e, d) => cb({ ...d, ready: true }));
		ipcRenderer.on('update-available', (e, d) => cb({ ...d, ready: false }));
	},
	installUpdate: () => ipcRenderer.invoke('install-update'),
});
