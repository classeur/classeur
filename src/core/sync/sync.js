angular.module('classeur.core.sync', [])
	.run(function($rootScope, $http, $location, clUserSvc, clFileSvc, clFolderSvc, clSocketSvc) {
		var lastSyncDate = 0;
		var lastCreationDate = 0;
		var maxInactivity = 30 * 1000; // 30 sec

		function updateLastSyncDate() {
			lastSyncDate = Date.now();
		}

		function updateLastCreationDate() {
			lastCreationDate = Date.now();
		}

		var folderSyncData = {};
		var fileSyncData = {};
		var contentSyncData = {};
		var isFirstSync = true;

		var syncFolders = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getFolderChanges',
					lastSeq: lastSeq
				});
			}

			var lastSeq = 0;
			clSocketSvc.addMsgHandler('folderChanges', function(msg) {
				updateLastSyncDate();
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
				updateLastSyncDate();
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
						delete contentSyncData[change.id];
					} else {
						fileSyncData[change.id] = {
							r: change.updated
						};
						contentSyncData[change.id] = contentSyncData[change.id] || {};
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
				clFileSvc.files.forEach(function(fileDao) {
					var syncData = fileSyncData[fileDao.id];
					if(!syncData) {
						return;
					}
					var change = {
						id: fileDao.id,
						name: fileDao.name,
						folderId: fileDao.folderId || undefined,
						updated: fileDao.updated
					};
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
				isFirstSync = false;
			}

			return retrieveChanges;
		})();

		function sendNewFiles() {
			updateLastCreationDate();
			var files = [];
			clFileSvc.files.forEach(function(fileDao) {
				if (!fileDao.contentDao.isLocal || contentSyncData.hasOwnProperty(fileDao.id)) {
					return;
				}
				var file = {
					id: fileDao.id
				};
				fileDao.loadExecUnload(function() {
					file.content = fileDao.contentDao.content;
					files.push(file);
				});
			});
			files.length && clSocketSvc.sendMsg({
				type: 'createFiles',
				files: files
			});
		}

		clSocketSvc.addMsgHandler('contentRev', function(msg) {
			updateLastCreationDate();
			fileSyncData[msg.id] = {};
			contentSyncData[msg.id] = {
				rev: msg.rev
			};
		});

		var watchedFileDao, watchedContentSyncData;
		clSocketSvc.addMsgHandler('signedInUser', function() {
			watchedFileDao = undefined;
		});

		function watchContent(fileDao) {
			if (!fileDao || (fileDao === watchedFileDao && watchedContentSyncData)) {
				return;
			}
			watchedFileDao = fileDao;
			watchedContentSyncData = contentSyncData[fileDao.id];
			watchedContentSyncData && clSocketSvc.sendMsg({
				type: 'startWatchContent',
				fileId: watchedFileDao.id
			});
		}

		function stopWatchContent() {
			if (watchedFileDao) {
				clSocketSvc.sendMsg({
					type: 'stopWatchContent',
					fileId: watchedFileDao.id
				});
				watchedFileDao = undefined;
			}
		}

		function sync() {
			if (!clSocketSvc.isReady) {
				return;
			}

			var currentDate = Date.now();
			if (!isFirstSync && currentDate - lastCreationDate > maxInactivity) {
				sendNewFiles();
			}
			if ($rootScope.currentFileDao !== watchedFileDao) {
				stopWatchContent();
			}
			watchContent($rootScope.currentFileDao);

			if (currentDate - lastSyncDate > maxInactivity) {
				updateLastSyncDate();
				syncFolders();
				syncFiles();
			}
		}
		$rootScope.$on('clPeriodicRun', sync);
	});
