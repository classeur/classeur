angular.module('classeur.core.sync', [])
	.run(function($rootScope, $location, clUserSvc, clFileSvc, clFolderSvc, clSocketSvc, clSetInterval, clEditorSvc, clSyncUtils) {
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
				syncData: contentSyncData[fileDao.id],
				contentChanges: []
			};
			watchCtx.syncData && clSocketSvc.sendMsg({
				type: 'startWatchContent',
				id: watchCtx.fileDao.id
			});
		}

		function stopWatchContent() {
			if (watchCtx.fileDao) {
				clSocketSvc.isReady && clSocketSvc.sendMsg({
					type: 'stopWatchContent'
				});
				watchCtx = {};
			}
		}

		clSocketSvc.addMsgHandler('content', function(msg) {
			if (!watchCtx.syncData || watchCtx.fileDao.id !== msg.id) {
				return;
			}
			var oldContent = msg.previous ? msg.previous.content : msg.latest.content;
			var serverContent = msg.latest.content;
			var isServerChanges = oldContent !== serverContent;
			var localContent = watchCtx.fileDao.contentDao.content;
			var isLocalChanges = oldContent !== localContent;
			var isSynchronized = serverContent === localContent;
			if (!isSynchronized && isServerChanges && isLocalChanges) {
				// Deal with conflict
				watchCtx.content = msg.previous.content;
				watchCtx.rev = msg.previous.rev;
				watchCtx.conflict = msg.latest;
			} else {
				watchCtx.content = msg.latest.content;
				watchCtx.rev = msg.latest.rev;
				watchCtx.syncData.rev = msg.rev;
				if (!isSynchronized && isServerChanges) {
					// Replace content
					clEditorSvc.cledit.setContent(msg.content);
				}
			}
		});

		function sendContentChange() {
			if (!watchCtx.rev || watchCtx.sentContentChange) {
				return;
			}
			var newContent = watchCtx.fileDao.contentDao.content;
			var changes = clSyncUtils.getPatches(watchCtx.content, newContent);
			if (!changes.length) {
				return;
			}
			var newRev = watchCtx.rev + 1;
			watchCtx.sentContentChange = JSON.stringify({
				rev: newRev,
				changes: changes
			});
			clSocketSvc.sendMsg({
				type: 'setContentChange',
				rev: newRev,
				changes: changes,
			});
		}

		clSocketSvc.addMsgHandler('contentChange', function(msg) {
			if (!watchCtx.rev || watchCtx.fileDao.id !== msg.id || watchCtx.rev >= msg.rev) {
				return;
			}
			watchCtx.contentChanges[msg.rev] = msg;
			var serverContent = watchCtx.content;
			while ((msg = watchCtx.contentChanges[watchCtx.rev + 1])) {
				watchCtx.rev = msg.rev;
				serverContent = clSyncUtils.applyPatches(serverContent, msg.changes);
				var receivedContentChange = JSON.stringify({
					rev: msg.rev,
					changes: msg.changes
				});
				if (watchCtx.sentContentChange === receivedContentChange) {
					watchCtx.content = serverContent;
				}
				watchCtx.sentContentChange = undefined;
			}
			var oldContent = watchCtx.content;
			var isServerChanges = oldContent !== serverContent;
			var localContent = watchCtx.fileDao.contentDao.content;
			var isLocalChanges = oldContent !== localContent;
			var isSynchronized = serverContent === localContent;
			if (!isSynchronized && isServerChanges) {
				if (isLocalChanges) {
					localContent = clSyncUtils.quickPatch(oldContent, serverContent, localContent);
				} else {
					localContent = serverContent;
				}
				clEditorSvc.cledit.setContent(localContent);
			}
			watchCtx.content = serverContent;
			watchCtx.syncData.rev = watchCtx.rev;
		});

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
			sendContentChange();
		}, 1000, true);

	})

.factory('clSyncUtils', function($window) {
	var diffMatchPatch = new $window.diff_match_patch();
	var DIFF_DELETE = -1;
	var DIFF_INSERT = 1;
	var DIFF_EQUAL = 0;

	function getPatches(oldContent, newContent) {
		var diffs = diffMatchPatch.diff_main(oldContent, newContent);
		diffMatchPatch.diff_cleanupEfficiency(diffs);
		var patches = [];
		var startOffset = 0;
		diffs.forEach(function(change) {
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
		return patches;
	}

	function applyPatches(content, patches) {
		if (!patches) {
			return content;
		}
		return patches.reduce(function(content, change) {
			if (change.ins) {
				return content.slice(0, change.off) + change.ins + content.slice(change.off);
			} else if (change.del) {
				return content.slice(0, change.off) + content.slice(change.off + change.del.length);
			} else {
				return content;
			}
		}, content);
	}

	function quickPatch(oldContent, newContent, destContent) {
		var diffs = diffMatchPatch.diff_main(oldContent, newContent);
		var patches = diffMatchPatch.patch_make(oldContent, diffs);
		var patchResult = diffMatchPatch.patch_apply(patches, destContent);
		console.log(patchResult)
		return patchResult[0];
	}

	return {
		getPatches: getPatches,
		applyPatches: applyPatches,
		quickPatch: quickPatch
	};
});
