angular.module('classeur.core.sync', [])
	.run(function($window, $rootScope, $http, $location, clUserSvc, clFileSvc, clFolderSvc, clSocketSvc, clSetInterval, clEditorSvc) {
		var lastSyncDate = 0;
		var lastCreationDate = 0;
		var maxSyncInactivity = 30 * 1000; // 30 sec
		var maxCreationInactivity = 30 * 1000; // 30 sec

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
					if (!syncData) {
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
			var newFiles = clFileSvc.files.filter(function(fileDao) {
				return fileDao.contentDao.isLocal && !contentSyncData.hasOwnProperty(fileDao.id);
			});
			if (newFiles.length) {
				updateLastCreationDate();
				newFiles.forEach(function(fileDao) {
					if (!fileDao.contentDao.isLocal || contentSyncData.hasOwnProperty(fileDao.id)) {
						return;
					}
					fileDao.loadExecUnload(function() {
						clSocketSvc.sendMsg({
							type: 'createFile',
							id: fileDao.id,
							content: fileDao.contentDao.content
						});
					});
				});
			}
		}

		clSocketSvc.addMsgHandler('contentRev', function(msg) {
			updateLastCreationDate();
			fileSyncData[msg.id] = {};
			contentSyncData[msg.id] = {
				rev: msg.rev
			};
		});

		var watchCtx = {};
		clSocketSvc.addMsgHandler('signedInUser', function() {
			watchCtx = {};
		});

		function watchContent(fileDao) {
			if (!fileDao || (fileDao === watchCtx.fileDao && watchCtx.syncData)) {
				return;
			}
			watchCtx = {
				fileDao: fileDao,
				syncData: contentSyncData[fileDao.id]
			};
			watchCtx.syncData && clSocketSvc.sendMsg({
				type: 'startWatchContent',
				id: watchCtx.fileDao.id
			});
		}

		function stopWatchContent() {
			if (watchCtx.fileDao) {
				clSocketSvc.isReady && clSocketSvc.sendMsg({
					type: 'stopWatchContent',
					fileId: watchCtx.fileDao.id
				});
				watchCtx = {};
			}
		}

		clSocketSvc.addMsgHandler('content', function(msg) {
			if (!watchCtx.fileDao || watchCtx.fileDao.id !== msg.id || !watchCtx.syncData) {
				return;
			}
			watchCtx.content = msg.content;
			watchCtx.rev = msg.rev;
			// Replace content
			watchCtx.syncData.content = msg.content;
			watchCtx.syncData.rev = msg.rev;
			clEditorSvc.cledit.setContent(msg.content);
		});

		var diffMatchPatch = new $window.diff_match_patch();
		var DIFF_DELETE = -1;
		var DIFF_INSERT = 1;
		var DIFF_EQUAL = 0;

		function sendContent() {
			if (!watchCtx.rev || watchCtx.sentRev) {
				return;
			}
			var newContent = watchCtx.fileDao.contentDao.content;
			var changes = diffMatchPatch.diff_main(watchCtx.content, newContent);
			var patches = [];
			var startOffset = 0;
			changes.forEach(function(change) {
				var changeType = change[0];
				var changeText = change[1];
				switch (changeType) {
					case DIFF_EQUAL:
						startOffset += changeText.length;
						break;
					case DIFF_DELETE:
						patches.push({
							off: startOffset,
							del: changeText
						});
						break;
					case DIFF_INSERT:
						patches.push({
							off: startOffset,
							ins: changeText
						});
						startOffset += changeText.length;
						break;
				}
			});
			if(!patches.length) {
				return;
			}
			watchCtx.sentRev = watchCtx.rev + 1;
			clSocketSvc.sendMsg({
				type: 'setContentChange',
				changes: patches,
				rev: watchCtx.sentRev
			});
		}

		clSetInterval(function() {
			if (!isFirstSync && Date.now() - lastCreationDate > maxCreationInactivity) {
				sendNewFiles();
			}
		}, 1000, true, true);

		clSetInterval(function() {
			if (Date.now() - lastSyncDate > maxSyncInactivity) {
				updateLastSyncDate();
				syncFolders();
				syncFiles();
			}
		}, 1000, true, true);

		$rootScope.$watch('currentFileDao', stopWatchContent);
		clSetInterval(function() {
			watchContent($rootScope.currentFileDao);
			sendContent();
		}, 1000, true);
	});
