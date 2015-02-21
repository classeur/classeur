angular.module('classeur.core.sync', [])
	.factory('clSyncSvc', function($rootScope, $location, clUserInfoSvc, clFileSvc, clFolderSvc, clSocketSvc, clSetInterval, clEditorSvc, clSyncUtils, clLocalStorageObject) {
		var lastCreateFileActivity = 0;
		var maxSyncInactivity = 30 * 1000; // 30 sec
		var createFileTimeout = 30 * 1000; // 30 sec

		var syncDataStore = clLocalStorageObject('syncData');

		var init = true;

		function readSyncDataStore(ctx) {
			function parseSyncData(data) {
				return JSON.parse(data, function(id, updated) {
					return typeof updated === "number" ? {
						r: updated
					} : updated;
				});
			}
			var checkSyncDataUpdate = syncDataStore.$checkGlobalUpdate();
			if (!init && !checkSyncDataUpdate) {
				return;
			}
			syncDataStore.$readAttr('lastActivity', '0', parseInt);
			syncDataStore.$readAttr('folders', '{}', parseSyncData);
			syncDataStore.$readAttr('lastFolderSeq', '0', parseInt);
			syncDataStore.$readAttr('files', '{}', parseSyncData);
			syncDataStore.$readAttr('lastFileSeq', '0', parseInt);
			syncDataStore.$readAttr('userId', '');
			syncDataStore.$readAttr('fileSyncReady', '');
			init = false;
			return ctx && ctx.user && checkUserChange(ctx.user);
		}

		function writeSyncDataStore(lastActivity) {
			function serializeSyncData(data) {
				return JSON.stringify(data, function(id, value) {
					return value.r || (value.s ? undefined : value);
				});
			}
			syncDataStore.lastActivity = lastActivity !== undefined ? lastActivity : Date.now();
			syncDataStore.$writeAttr('lastActivity');
			syncDataStore.$writeAttr('folders', serializeSyncData);
			syncDataStore.$writeAttr('lastFolderSeq');
			syncDataStore.$writeAttr('files', serializeSyncData);
			syncDataStore.$writeAttr('lastFileSeq');
			syncDataStore.$writeAttr('userId');
			syncDataStore.$writeAttr('fileSyncReady');
		}

		function checkUserChange(user) {
			if (user.id !== syncDataStore.userId) {
				// Clear sync data
				var fileKeyPrefix = /^(cr\.|syncData\.)/;
				for (var key in localStorage) {
					if (key.match(fileKeyPrefix)) {
						localStorage.removeItem(key);
					}
				}
				clFileSvc.cleanNonLocalFiles();
				readSyncDataStore();
				syncDataStore.userId = user.id;
				writeSyncDataStore(0);
				return true;
			}
		}

		clSocketSvc.addMsgHandler('signedInUser', function(msg) {
			readSyncDataStore();
			checkUserChange(msg.user);
		});

		var contentRevStore = clLocalStorageObject('cr');

		(function() {
			var fileKeyPrefix = /^cr\.(\w\w+)/;
			for (var key in localStorage) {
				var fileDao, match = key.match(fileKeyPrefix);
				if (match) {
					fileDao = clFileSvc.fileMap[match[1]];
					if (!fileDao || !fileDao.contentDao.isLocal) {
						localStorage.removeItem(key);
					}
				}
			}
		})();

		var syncFolders = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getFolderChanges',
					lastSeq: syncDataStore.lastFolderSeq
				});
			}

			clSocketSvc.addMsgHandler('folderChanges', function(msg, ctx) {
				if(readSyncDataStore(ctx)) {
					return;
				}
				var foldersToUpdate = [];
				msg.changes.forEach(function(change) {
					var folderDao = clFolderSvc.folderMap[change.id];
					var syncData = syncDataStore.folders[change.id] || {};
					/*jshint -W018 */
					if (!change.deleted === !folderDao ||
						(folderDao && folderDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
					) {
						foldersToUpdate.push(change);
					}
					/*jshint +W018 */
					if (change.deleted) {
						delete syncDataStore.folders[change.id];
					} else {
						syncDataStore.folders[change.id] = {
							r: change.updated
						};
					}
					syncDataStore.lastFolderSeq = change.seq;
				});
				if (foldersToUpdate.length) {
					clFolderSvc.updateFolders(foldersToUpdate);
					$rootScope.$evalAsync();
				}
				if (msg.lastSeq) {
					syncDataStore.lastFolderSeq = msg.lastSeq;
					retrieveChanges();
				} else {
					sendChanges();
				}
				writeSyncDataStore();
			});

			function sendChanges() {
				var changes = [];
				clFolderSvc.folders.forEach(function(folderDao) {
					var syncData = syncDataStore.folders[folderDao.id] || {};
					if (folderDao.updated == syncData.r) {
						return;
					}
					changes.push({
						id: folderDao.id,
						name: folderDao.name,
						sharing: folderDao.sharing,
						updated: folderDao.updated
					});
					syncData.s = folderDao.updated;
					syncDataStore.folders[folderDao.id] = syncData;
				});
				// Check deleted folders
				angular.forEach(syncDataStore.folders, function(syncData, id) {
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
					lastSeq: syncDataStore.lastFileSeq
				});
			}

			clSocketSvc.addMsgHandler('fileChanges', function(msg, ctx) {
				if(readSyncDataStore(ctx)) {
					return;
				}
				var filesToUpdate = [];
				msg.changes.forEach(function(change) {
					var fileDao = clFileSvc.fileMap[change.id];
					var syncData = syncDataStore.files[change.id] || {};
					/*jshint -W018 */
					if (!change.deleted === !fileDao ||
						(fileDao && fileDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
					) {
						filesToUpdate.push(change);
					}
					/*jshint +W018 */
					if (change.deleted) {
						delete syncDataStore.files[change.id];
					} else {
						syncDataStore.files[change.id] = {
							r: change.updated
						};
					}
					syncDataStore.lastFileSeq = change.seq;
				});
				if (filesToUpdate.length) {
					clFileSvc.updateFiles(filesToUpdate);
					$rootScope.$evalAsync();
				}
				if (msg.lastSeq) {
					syncDataStore.lastFileSeq = msg.lastSeq;
					retrieveChanges();
				} else {
					sendChanges();
				}
				writeSyncDataStore();
			});

			function sendChanges() {
				var changes = [];
				clFileSvc.files.forEach(function(fileDao) {
					var syncData = syncDataStore.files[fileDao.id] || {};
					if (!syncData.r || fileDao.updated == syncData.r) {
						return;
					}
					changes.push({
						id: fileDao.id,
						name: fileDao.name,
						folderId: fileDao.folderId || undefined,
						sharing: fileDao.sharing || undefined,
						updated: fileDao.updated
					});
					syncData.s = fileDao.updated;
					syncDataStore.files[fileDao.id] = syncData;
				});
				// Check deleted files
				angular.forEach(syncDataStore.files, function(syncData, id) {
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
				syncDataStore.fileSyncReady = '1';
			}

			return retrieveChanges;
		})();

		/********
		New files
		********/

		var expectedFileCreations = {};
		var sendNewFiles = (function() {
			function sendNewFiles() {
				expectedFileCreations = {};
				clFileSvc.files.filter(function(fileDao) {
					return fileDao.contentDao.isLocal && !syncDataStore.files.hasOwnProperty(fileDao.id);
				}).forEach(function(fileDao) {
					expectedFileCreations[fileDao.id] = true;
					fileDao.loadExecUnload(function() {
						clSocketSvc.sendMsg({
							type: 'createFile',
							id: fileDao.id,
							content: fileDao.contentDao.content
						});
					});
				});
			}

			clSocketSvc.addMsgHandler('contentRev', function(msg, ctx) {
				if(readSyncDataStore(ctx)) {
					return;
				}
				lastCreateFileActivity = Date.now();
				delete expectedFileCreations[msg.id];
				syncDataStore.files[msg.id] = {
					r: -1
				};
				contentRevStore[msg.id] = msg.rev;
				contentRevStore.$writeAttr(msg.id);
				writeSyncDataStore();
			});

			return sendNewFiles;
		})();


		/**************
		Content changes
		**************/

		var watchCtx;

		function setWatchCtx(ctx) {
			watchCtx = ctx;
			clSyncSvc.watchCtx = ctx;
		}
		var unsetWatchCtx = setWatchCtx.bind(undefined, undefined);
		clSocketSvc.addMsgHandler('signedInUser', unsetWatchCtx);

		function watchContent(fileDao) {
			if (!fileDao || (watchCtx && fileDao === watchCtx.fileDao && watchCtx.fileExists)) {
				return;
			}
			contentRevStore.$readAttr(fileDao.id, '0', parseInt);
			setWatchCtx({
				fileDao: fileDao,
				fileExists: syncDataStore.files.hasOwnProperty(fileDao.id),
				rev: contentRevStore[fileDao.id],
				userActivities: {},
				contentChanges: []
			});
			watchCtx.fileExists && clSocketSvc.sendMsg({
				type: 'startWatchContent',
				id: watchCtx.fileDao.id,
				previousRev: watchCtx.rev
			});
		}

		function stopWatchContent() {
			if (watchCtx && watchCtx.fileDao) {
				clSocketSvc.sendMsg({
					type: 'stopWatchContent'
				});
				unsetWatchCtx();
			}
		}

		clSocketSvc.addMsgHandler('content', function(msg) {
			if (!watchCtx || watchCtx.fileDao.id !== msg.id) {
				return;
			}
			var oldContent = msg.previous ? msg.previous.content : msg.latest.content;
			var serverContent = msg.latest.content;
			var localContent = watchCtx.fileDao.isLoaded ? clEditorSvc.cledit.getContent() : undefined;
			var isServerChanges = oldContent !== serverContent;
			var isLocalChanges = oldContent !== localContent;
			var isSynchronized = serverContent === localContent;
			if (!isSynchronized && isServerChanges && isLocalChanges) {
				// TODO Deal with conflict
				watchCtx.content = msg.latest.content;
				watchCtx.rev = msg.latest.rev;
				clEditorSvc.cledit.setContent(watchCtx.content);
			} else {
				watchCtx.content = msg.latest.content;
				watchCtx.rev = msg.latest.rev;
				if (!isSynchronized) {
					if (isServerChanges) {
						clEditorSvc.cledit.setContent(watchCtx.content);
					} else if (!watchCtx.fileDao.isLoaded) {
						watchCtx.fileDao.contentDao.content = watchCtx.content;
						watchCtx.fileDao.onLoaded && watchCtx.fileDao.onLoaded();
					}
				}
			}
			contentRevStore[msg.id] = watchCtx.rev;
			contentRevStore.$writeAttr(msg.id);
			msg.latest.userIds.forEach(clUserInfoSvc.request);
		});

		function sendContentChange() {
			if (!watchCtx || watchCtx.content === undefined || watchCtx.sentMsg) {
				return;
			}
			var newContent = clEditorSvc.cledit.getContent();
			var changes = clSyncUtils.getPatches(watchCtx.content, newContent);
			if (!changes.length) {
				return;
			}
			var newRev = watchCtx.rev + 1;
			watchCtx.sentMsg = {
				type: 'setContentChange',
				rev: newRev,
				changes: changes
			};
			clSocketSvc.sendMsg(watchCtx.sentMsg);
		}

		clSocketSvc.addMsgHandler('contentChange', function(msg) {
			if (!watchCtx || watchCtx.fileDao.id !== msg.id || watchCtx.rev >= msg.rev) {
				return;
			}
			watchCtx.contentChanges[msg.rev] = msg;
			var serverContent = watchCtx.content;
			var localContent = clEditorSvc.cledit.getContent();
			while ((msg = watchCtx.contentChanges[watchCtx.rev + 1])) {
				watchCtx.rev = msg.rev;
				watchCtx.contentChanges[msg.rev] = undefined;
				var oldContent = serverContent;
				if (!msg.userId && watchCtx.sentMsg && msg.rev === watchCtx.sentMsg.rev) {
					// This has to be the previously sent message
					msg = watchCtx.sentMsg;
				}
				serverContent = clSyncUtils.applyPatches(serverContent, msg.changes);
				if (msg !== watchCtx.sentMsg) {
					var isServerChanges = oldContent !== serverContent;
					var isLocalChanges = oldContent !== localContent;
					var isSynchronized = serverContent === localContent;
					if (!isSynchronized && isServerChanges) {
						if (isLocalChanges) {
							localContent = clSyncUtils.quickPatch(oldContent, serverContent, localContent);
						} else {
							localContent = serverContent;
						}
						var offset = clEditorSvc.cledit.setContent(localContent);
						var userActivity = watchCtx.userActivities[msg.userId] || {};
						userActivity.offset = offset;
						watchCtx.userActivities[msg.userId] = userActivity;
					}
					clUserInfoSvc.request(msg.userId);
				}
				watchCtx.sentMsg = undefined;
			}
			watchCtx.content = serverContent;
			contentRevStore[watchCtx.fileDao.id] = watchCtx.rev;
			contentRevStore.$writeAttr(watchCtx.fileDao.id);
		});

		clSetInterval(function() {
			// Retrieve and send files and folders modifications
			readSyncDataStore(clSocketSvc.ctx);
			if (Date.now() - syncDataStore.lastActivity > maxSyncInactivity) {
				syncFolders();
				syncFiles();
				writeSyncDataStore();
			}
			// Send new files
			if (Object.keys(expectedFileCreations).length === 0) {
				lastCreateFileActivity = 0;
			}
			if (syncDataStore.fileSyncReady && Date.now() - lastCreateFileActivity > createFileTimeout) {
				sendNewFiles();
			}
		}, 1000, true, true);

		$rootScope.$watch('currentFileDao', function(currentFileDao) {
			readSyncDataStore(clSocketSvc.ctx);
			stopWatchContent();
			watchContent(currentFileDao);
		});
		clSetInterval(function() {
			if(readSyncDataStore(clSocketSvc.ctx)) {
				stopWatchContent();
			}
			watchContent($rootScope.currentFileDao);
			sendContentChange();
		}, 500, true);

		var clSyncSvc = {};
		return clSyncSvc;
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
			return patchResult[0];
		}

		return {
			getPatches: getPatches,
			applyPatches: applyPatches,
			quickPatch: quickPatch
		};
	});
