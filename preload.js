'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
	openPath: p => ipcRenderer.invoke('open-path', p),
	version: () => ipcRenderer.invoke('app-version'),
	openExternal: url => ipcRenderer.invoke('open-external', url),
	onUpdate: cb => {
		ipcRenderer.on('update-ready', (e, d) => cb({ ...d, type: 'ready' }));
		ipcRenderer.on('update-available', (e, d) => cb({ ...d, type: 'available' }));
		ipcRenderer.on('update-progress', (e, d) => cb({ ...d, type: 'progress' }));
		ipcRenderer.on('update-error', (e, d) => cb({ ...d, type: 'error' }));
	},
	checkUpdates: () => ipcRenderer.invoke('check-updates'),
	updatesDisabled: () => ipcRenderer.invoke('updates-disabled'),
	downloadUpdate: () => ipcRenderer.invoke('download-update'),
	installUpdate: () => ipcRenderer.invoke('install-update'),
});
