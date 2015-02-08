angular.module('classeur.core.sync', [])
	.run(function($rootScope, $http, $location, clUserSvc, clFileSvc, clFolderSvc, clSocketSvc) {
		var lastActivity = 0;
		var maxInactivity = 60 * 1000; // 60 sec

		function updateLastActivity() {
			lastActivity = Date.now();
		}

		var fileSyncData = {};
		var folderSyncData = {};

		var syncFolders = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getFolderChanges',
					lastSeq: lastSeq
				});
			}

			var lastSeq = 0;
			clSocketSvc.addMsgHandler('folderChanges', function(msg) {
				updateLastActivity();
				var foldersToUpdate = [];
				msg.changes.forEach(function(change) {
					var folderDao = clFolderSvc.folderMap[change.id];
					var syncData = folderSyncData[change.id] || {};
					/*jshint -W018 */
					if (!change.deleted === !folderDao ||
						(folderDao && folderDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
					) {
						foldersToUpdate.push(change);
					}
					/*jshint +W018 */
					if (change.deleted) {
						delete folderSyncData[change.id];
					} else {
						folderSyncData[change.id] = {
							r: change.updated
						};
					}
					lastSeq = change.seq;
				});
				if (foldersToUpdate.length) {
					clFolderSvc.updateFolders(foldersToUpdate);
					$rootScope.$apply();
				}
				if (msg.lastSeq) {
					lastSeq = msg.lastSeq;
					return retrieveChanges();
				}
				sendChanges();
			});

			function sendChanges() {
				var changes = [];
				clFolderSvc.folders.forEach(function(folderDao) {
					var syncData = folderSyncData[folderDao.id] || {};
					if (folderDao.updated == syncData.r) {
						return;
					}
					changes.push({
						id: folderDao.id,
						name: folderDao.name,
						updated: folderDao.updated
					});
					syncData.s = folderDao.updated;
					folderSyncData[folderDao.id] = syncData;
				});
				// Check deleted folders
				angular.forEach(folderSyncData, function(syncData, id) {
					if (!clFolderSvc.folderMap.hasOwnProperty(id)) {
						changes.push({
							id: id,
							deleted: true
						});
					}
				});
				changes.length && clSocketSvc.sendMsg({
					type: 'setFolderChanges',
					changes: changes
				});
			}

			return retrieveChanges;
		})();

		var syncFiles = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getFileChanges',
					lastSeq: lastSeq
				});
			}

			var lastSeq = 0;
			clSocketSvc.addMsgHandler('fileChanges', function(msg) {
				updateLastActivity();
				var filesToUpdate = [];
				msg.changes.forEach(function(change) {
					var fileDao = clFileSvc.fileMap[change.id];
					var syncData = fileSyncData[change.id] || {};
					/*jshint -W018 */
					if (!change.deleted === !fileDao ||
						(fileDao && fileDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
					) {
						filesToUpdate.push(change);
					}
					/*jshint +W018 */
					if (change.deleted) {
						delete fileSyncData[change.id];
					} else {
						fileSyncData[change.id] = {
							r: change.updated
						};
					}
					lastSeq = change.seq;
				});
				if (filesToUpdate.length) {
					clFileSvc.updateFiles(filesToUpdate);
					$rootScope.$apply();
				}
				if (msg.lastSeq) {
					lastSeq = msg.lastSeq;
					return retrieveChanges();
				}
				sendChanges();
			});

			function sendChanges() {
				var changes = [];
				var newFiles = [];
				clFileSvc.files.forEach(function(fileDao) {
					var syncData = fileSyncData[fileDao.id];
					var change = {
						id: fileDao.id,
						name: fileDao.name,
						folderId: fileDao.folderId || undefined,
						updated: fileDao.updated
					};
					if(!syncData) {
						if(fileDao.contentDao.isLocal) {
							fileDao.loadExecUnload(function() {
								change.content = fileDao.contentDao.content;
							});
							newFiles.push(change);
						}
						return;
					}
					if (fileDao.updated == syncData.r) {
						return;
					}
					changes.push(change);
					syncData.s = fileDao.updated;
					fileSyncData[fileDao.id] = syncData;
				});
				// Check deleted files
				angular.forEach(fileSyncData, function(syncData, id) {
					if (!clFileSvc.fileMap.hasOwnProperty(id)) {
						changes.push({
							id: id,
							deleted: true
						});
					}
				});
				changes.length && clSocketSvc.sendMsg({
					type: 'setFileChanges',
					changes: changes
				});
				newFiles.length && clSocketSvc.sendMsg({
					type: 'createFiles',
					files: newFiles
				});
			}

			clSocketSvc.addMsgHandler('createdFile', function(msg) {
				updateLastActivity();
				fileSyncData[msg.id] = {
					r: msg.updated
				};
			});

			return retrieveChanges;
		})();

		function sync() {
			if (!clSocketSvc.isReady) {
				return;
			}
			if (Date.now() - lastActivity < maxInactivity) {
				return;
			}
			updateLastActivity();
			syncFolders();
			syncFiles();
		}
		$rootScope.$on('clPeriodicRun', sync);
	});
