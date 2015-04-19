angular.module('classeur.core.sync', [])
	.factory('clSyncSvc', function($rootScope, $location, $http, $timeout, $window, clLocalStorage, clToast, clUserSvc, clUserInfoSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clSocketSvc, clUserActivity, clSetInterval, clEditorSvc, clSyncUtils, clLocalStorageObject) {
		var clSyncSvc = {};
		var lastCreateFileActivity = 0;
		var nameMaxLength = 128;
		var maxSyncInactivity = 30 * 1000; // 30 sec
		var createFileTimeout = 30 * 1000; // 30 sec
		var loadingTimeout = 30 * 1000; // 30 sec
		var sendMetadataAfter = clToast.hideDelay + 2000; // 8 sec (more than toast duration to handle undo)
		var extFileRefreshAfter = 60 * 1000; // 60 sec

		function parseSyncData(data) {
			return JSON.parse(data, function(id, value) {
				return typeof value === 'number' && id !== 'r' && id !== 's' ? {
					r: value
				} : value;
			});
		}

		function serializeSyncData(data) {
			return JSON.stringify(data, function(id, value) {
				return (value && !value.s && value.r) || value;
			});
		}

		var syncDataStore = clLocalStorageObject('syncData', {
			lastActivity: {
				default: '0',
				parser: parseInt
			},
			folders: {
				default: '{}',
				parser: parseSyncData,
				serializer: serializeSyncData,
			},
			lastFolderSeq: {
				default: '0',
				parser: parseInt
			},
			files: {
				default: '{}',
				parser: parseSyncData,
				serializer: serializeSyncData,
			},
			lastFileSeq: {
				default: '0',
				parser: parseInt
			},
			userId: {},
			userData: {
				default: '{}',
				parser: parseSyncData,
				serializer: serializeSyncData,
			},
			fileSyncReady: {},
		});

		var init = true;

		function readSyncDataStore(ctx) {
			var checkSyncDataUpdate = syncDataStore.$checkUpdate();
			if (!init && !checkSyncDataUpdate) {
				return;
			}
			syncDataStore.$read();
			syncDataStore.$readUpdate();
			init = false;
			return ctx && ctx.userId && checkUserChange(ctx.userId);
		}

		function writeSyncDataStore(lastActivity) {
			syncDataStore.lastActivity = lastActivity || Date.now();
			syncDataStore.$write();
		}

		function checkUserChange(userId) {
			if (userId !== syncDataStore.userId) {
				var fileKeyPrefix = /^(cr\.|syncData\.)/;
				Object.keys(clLocalStorage).forEach(function(key) {
					if (key.match(fileKeyPrefix)) {
						clLocalStorage.removeItem(key);
					}
				});
				var filesToRemove = clFileSvc.files.filter(function(fileDao) {
					if (!fileDao.userId) {
						if (!fileDao.contentDao.isLocal) {
							return true;
						}
						fileDao.userId = syncDataStore.userId;
					} else if (fileDao.userId === userId) {
						fileDao.userId = '';
					}
				});
				clFileSvc.removeFiles(filesToRemove);
				clFolderSvc.folders.forEach(function(folderDao) {
					if (!folderDao.userId) {
						folderDao.userId = syncDataStore.userId;
					} else if (folderDao.userId === userId) {
						folderDao.userId = '';
					}
				});
				readSyncDataStore();
				syncDataStore.userId = userId;
				// Force sync
				writeSyncDataStore(1);
				return true;
			}
		}

		clSocketSvc.addMsgHandler('userToken', function(msg) {
			readSyncDataStore();
			checkUserChange(msg.userId);
			clFileSvc.files.forEach(function(fileDao) {
				if (fileDao.userId === msg.userId) {
					fileDao.userId = '';
				}
			});
		});

		var contentRevKeyPrefix = 'cr.';
		var contentRevStore = {
			setRev: function(fileId, rev) {
				clLocalStorage.setItem(contentRevKeyPrefix + fileId, rev);
			},
			getRev: function(fileId) {
				var rev = parseInt(clLocalStorage[contentRevKeyPrefix + fileId]);
				return isNaN(rev) ? undefined : rev;
			}
		};

		(function() {
			var fileKeyPrefix = /^cr\.(\w\w+)/;
			Object.keys(clLocalStorage).forEach(function(key) {
				var fileDao, match = key.match(fileKeyPrefix);
				if (match) {
					fileDao = clFileSvc.fileMap[match[1]];
					if (!fileDao || !fileDao.contentDao.isLocal) {
						clLocalStorage.removeItem(key);
					}
				}
			});
		})();


		/***
		User
		***/

		var syncUser = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getUserData',
					userUpdated: clUserSvc.user && (syncDataStore.userData.user || {}).r,
					classeursUpdated: (syncDataStore.userData.classeurs || {}).r,
					settingsUpdated: (syncDataStore.userData.settings || {}).r
				});
			}

			clSocketSvc.addMsgHandler('userData', function(msg, ctx) {
				if (readSyncDataStore(ctx)) {
					return;
				}
				var apply, syncData;
				if (msg.user) {
					syncData = syncDataStore.userData.user || {};
					if (syncData.s !== msg.userUpdated) {
						clUserSvc.user = msg.user;
						clUserSvc.write(msg.userUpdated);
						apply = true;
					}
					syncDataStore.userData.user = {
						r: msg.userUpdated
					};
				}
				if (msg.classeurs) {
					syncData = syncDataStore.userData.classeurs || {};
					if (syncData.s !== msg.classeursUpdated) {
						clClasseurSvc.init(msg.classeurs);
						clClasseurSvc.write(msg.classeursUpdated);
						apply = true;
					}
					syncDataStore.userData.classeurs = {
						r: msg.classeursUpdated
					};
					clSyncSvc.getExtFoldersMetadata();
				}
				if (msg.settings) {
					syncData = syncDataStore.userData.settings || {};
					if (syncData.s !== msg.settingsUpdated) {
						clSettingSvc.settings.values = msg.settings;
						clSettingSvc.settings.write(msg.settingsUpdated);
						apply = true;
					}
					syncDataStore.userData.settings = {
						r: msg.settingsUpdated
					};
				}
				apply && $rootScope.$evalAsync();
				sendChanges();
				writeSyncDataStore();
			});

			function sendChanges() {
				var syncData, msg = {
					type: 'setUserData'
				};
				syncData = syncDataStore.userData.user || {};
				if (clUserSvc.updated !== syncData.r) {
					msg.user = clUserSvc.user;
					msg.userUpdated = clUserSvc.updated;
					syncData.s = clUserSvc.updated;
					syncDataStore.userData.user = syncData;
				}
				syncData = syncDataStore.userData.classeurs || {};
				if (clClasseurSvc.updated !== syncData.r) {
					msg.classeurs = clClasseurSvc.classeurs.map(function(classeurDao) {
						return classeurDao.toStorable();
					});
					msg.classeursUpdated = clClasseurSvc.updated;
					syncData.s = clClasseurSvc.updated;
					syncDataStore.userData.classeurs = syncData;
				}
				syncData = syncDataStore.userData.settings || {};
				if (clSettingSvc.settings.updated !== syncData.r) {
					msg.settings = clSettingSvc.settings.values;
					msg.settingsUpdated = clSettingSvc.settings.updated;
					syncData.s = clSettingSvc.settings.updated;
					syncDataStore.userData.settings = syncData;
				}
				Object.keys(msg).length > 1 && clSocketSvc.sendMsg(msg);
			}

			return retrieveChanges;
		})();


		/******
		Folders
		******/

		var syncFolders = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getFolderChanges',
					lastSeq: syncDataStore.lastFolderSeq
				});
			}

			var expectedFolderDeletions = [];
			clSocketSvc.addMsgHandler('folderChanges', function(msg, ctx) {
				if (readSyncDataStore(ctx)) {
					return;
				}
				var foldersToUpdate = [];
				expectedFolderDeletions.forEach(function(id) {
					// Assume folders have been deleted
					delete syncDataStore.folders[id];
				});
				(msg.changes || []).forEach(function(change) {
					var folderDao = clFolderSvc.folderMap[change.id];
					var syncData = syncDataStore.folders[change.id] || {};
					if (syncData.s !== change.updated) {
						/*jshint -W018 */
						if (!change.deleted === !folderDao ||
							(folderDao && folderDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
						) {
							foldersToUpdate.push(change);
						}
						/*jshint +W018 */
					}
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
					// Sync user's classeurs once all folders are synced
					syncUser();
					sendChanges();
				}
				writeSyncDataStore();
			});

			function checkChange(folderDao) {
				if (folderDao.name) {
					if (folderDao.name.length > nameMaxLength) {
						folderDao.name = folderDao.name.slice(0, nameMaxLength);
					} else {
						return folderDao.updated < Date.now() - sendMetadataAfter;
					}
				}
			}

			function sendChanges() {
				var changes = [];
				clFolderSvc.folders.forEach(function(folderDao) {
					var syncData = syncDataStore.folders[folderDao.id] || {};
					if (folderDao.updated == syncData.r || !checkChange(folderDao)) {
						return;
					}
					if (!folderDao.userId) {
						changes.push({
							id: folderDao.id,
							name: folderDao.name,
							sharing: folderDao.sharing || undefined,
							updated: folderDao.updated
						});
						syncData.s = folderDao.updated;
						syncDataStore.folders[folderDao.id] = syncData;
					} else if (folderDao.lastUpdated && folderDao.updated !== folderDao.lastUpdated && folderDao.sharing === 'rw') {
						changes.push({
							id: folderDao.id,
							userId: folderDao.userId,
							name: folderDao.name,
							updated: folderDao.updated,
							lastUpdated: folderDao.lastUpdated
						});
						folderDao.lastUpdated = folderDao.updated;
					}
				});
				// Check deleted folders
				expectedFolderDeletions = [];
				angular.forEach(syncDataStore.folders, function(syncData, id) {
					if (!clFolderSvc.folderMap.hasOwnProperty(id)) {
						expectedFolderDeletions.push(id);
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


		/****
		Files
		****/

		var syncFiles = (function() {

			function retrieveChanges() {
				clSocketSvc.sendMsg({
					type: 'getFileChanges',
					lastSeq: syncDataStore.lastFileSeq
				});
			}

			var expectedFileDeletions = [];
			var expectedFileRecoveries = [];
			clSocketSvc.addMsgHandler('fileChanges', function(msg, ctx) {
				if (readSyncDataStore(ctx)) {
					return;
				}
				var filesToUpdate = [];
				expectedFileDeletions.forEach(function(id) {
					// Assume files have been deleted
					delete syncDataStore.files[id];
				});
				expectedFileRecoveries.forEach(function(id) {
					delete clSyncSvc.filesToRecover[id];
				});
				(msg.changes || []).forEach(function(change) {
					var fileDao = clFileSvc.fileMap[change.id];
					var syncData = syncDataStore.files[change.id] || {};
					if (syncData.s !== change.updated) {
						/*jshint -W018 */
						if (!change.deleted === !fileDao ||
							(fileDao && fileDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
						) {
							filesToUpdate.push(change);
						}
						/*jshint +W018 */
					}
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

			function checkChange(fileDao) {
				if (fileDao.name) {
					if (fileDao.name.length > nameMaxLength) {
						fileDao.name = fileDao.name.slice(0, nameMaxLength);
					} else {
						return fileDao.updated < Date.now() - sendMetadataAfter;
					}
				}
			}

			clSyncSvc.filesToRecover = {};

			function sendChanges() {
				var changes = [];
				clFileSvc.files.forEach(function(fileDao) {
					var syncData = syncDataStore.files[fileDao.id] || {};
					if (fileDao.updated == syncData.r || !checkChange(fileDao)) {
						return;
					}
					// Check that the file was previously created
					if (syncData.r && !fileDao.userId) {
						changes.push({
							id: fileDao.id,
							name: fileDao.name,
							folderId: fileDao.folderId || undefined,
							sharing: fileDao.sharing || undefined,
							updated: fileDao.updated
						});
						syncData.s = fileDao.updated;
						syncDataStore.files[fileDao.id] = syncData;
					} else if (fileDao.lastUpdated && fileDao.updated !== fileDao.lastUpdated && fileDao.sharing === 'rw') {
						changes.push({
							id: fileDao.id,
							userId: fileDao.userId,
							name: fileDao.name,
							updated: fileDao.updated,
							lastUpdated: fileDao.lastUpdated
						});
						fileDao.lastUpdated = fileDao.updated;
					}

				});
				// Check deleted files
				expectedFileDeletions = [];
				angular.forEach(syncDataStore.files, function(syncData, id) {
					if (!clFileSvc.fileMap.hasOwnProperty(id)) {
						expectedFileDeletions.push(id);
						// Check that file has metadata
						(syncData.r > 0 || syncData.s) && changes.push({
							id: id,
							deleted: true
						});
					}
				});
				// Files to recover
				expectedFileRecoveries = [];
				angular.forEach(clSyncSvc.filesToRecover, function(file, id) {
					if (!clFileSvc.fileMap.hasOwnProperty(id)) {
						expectedFileRecoveries.push(id);
						changes.push({
							id: id,
							name: file.name,
							folderId: file.folderId || undefined,
							sharing: file.sharing || undefined,
							updated: Date.now()
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


		/*********************
		External files/folders
		*********************/

		function updateExtFileMetadata(fileDao, metadata) {
			fileDao.lastRefresh = Date.now();
			// File permission can change without metadata update
			if (metadata.updated && (!fileDao.lastUpdated || metadata.updated !== fileDao.lastUpdated || fileDao.sharing !== metadata.permission)) {
				fileDao.name = metadata.name;
				// For external files we take the permission as the file sharing
				fileDao.sharing = metadata.permission;
				fileDao.updated = metadata.updated;
				fileDao.lastUpdated = metadata.updated;
				fileDao.write(fileDao.updated);
			}
		}

		var lastGetExtFileAttempt = 0;
		clSyncSvc.getExtFilesMetadata = function() {
			var currentDate = Date.now();
			var filesToRefresh = clFileSvc.files.filter(function(fileDao) {
				return fileDao.userId && (!fileDao.lastRefresh || currentDate - extFileRefreshAfter > fileDao.lastRefresh);
			});
			if (!filesToRefresh.length ||
				currentDate - lastGetExtFileAttempt < extFileRefreshAfter ||
				$window.navigator.onLine === false
			) {
				return;
			}
			lastGetExtFileAttempt = currentDate;
			$http.get('/api/metadata/files', {
					timeout: loadingTimeout,
					params: {
						id: filesToRefresh.map(function(fileDao) {
							return fileDao.id;
						}).join(','),
						userId: filesToRefresh.map(function(fileDao) {
							return fileDao.userId;
						}).join(','),
					}
				})
				.success(function(res) {
					lastGetExtFileAttempt = 0;
					res.forEach(function(item) {
						var fileDao = clFileSvc.fileMap[item.id];
						if (fileDao) {
							updateExtFileMetadata(fileDao, item);
							item.updated || clToast('File is not accessible: ' + fileDao.name);
						}
					});
				});
		};

		function updateExtFolderMetadata(folderDao, metadata) {
			if (metadata.updated && (!folderDao.lastUpdated || metadata.updated !== folderDao.lastUpdated)) {
				folderDao.name = metadata.name;
				folderDao.sharing = metadata.sharing;
				folderDao.updated = metadata.updated;
				folderDao.lastUpdated = metadata.updated;
				folderDao.write(folderDao.updated);
			}
		}

		clSyncSvc.getExtFoldersMetadata = function() {
			var foldersToRefresh = clFolderSvc.folders.filter(function(folderDao) {
				return folderDao.userId && !folderDao.name;
			});
			if (!foldersToRefresh.length ||
				$window.navigator.onLine === false
			) {
				return;
			}
			$http.get('/api/metadata/folders', {
					timeout: loadingTimeout,
					params: {
						id: foldersToRefresh.map(function(folderDao) {
							return folderDao.id;
						}).join(','),
						userId: foldersToRefresh.map(function(folderDao) {
							return folderDao.userId;
						}).join(','),
					}
				})
				.success(function(res) {
					res.forEach(function(item) {
						var folderDao = clFolderSvc.folderMap[item.id];
						if (folderDao) {
							updateExtFolderMetadata(folderDao, item);
						}
					});
				});
		};

		clSyncSvc.getExtFolder = function(folderDao) {
			if (!folderDao || !folderDao.userId ||
				(folderDao.lastRefresh && Date.now() - folderDao.lastRefresh < extFileRefreshAfter) ||
				$window.navigator.onLine === false
			) {
				return;
			}
			$http.get('/api/users/' + folderDao.userId + '/folders/' + folderDao.id, {
					timeout: loadingTimeout
				})
				.success(function(res) {
					folderDao.removeOnFailure = false;
					folderDao.lastRefresh = Date.now();
					updateExtFolderMetadata(folderDao, res);
					var filesToMove = {};
					clFileSvc.files.forEach(function(fileDao) {
						if (fileDao.folderId === folderDao.id) {
							filesToMove[fileDao.id] = fileDao;
						}
					});
					res.files.forEach(function(item) {
						delete filesToMove[item.id];
						var fileDao = clFileSvc.fileMap[item.id];
						if (!fileDao) {
							fileDao = clFileSvc.createPublicFile(item.userId, item.id);
							clFileSvc.fileMap[fileDao.id] = fileDao;
							clFileSvc.fileIds.push(fileDao.id);
						}
						fileDao.folderId = folderDao.id;
						updateExtFileMetadata(fileDao, item);
					});
					angular.forEach(filesToMove, function(fileDao) {
						fileDao.folderId = '';
					});
					clFileSvc.init();
				})
				.error(function() {
					folderDao.lastRefresh = 1; // Get rid of the spinner
					clToast('Folder is not accessible.');
					folderDao.removeOnFailure && clFolderSvc.removeFolder(folderDao);
				});
		};


		/********
		New files
		********/

		function isFilePendingCreation(fileDao) {
			return !fileDao.userId && fileDao.contentDao.isLocal && !syncDataStore.files.hasOwnProperty(fileDao.id);
		}

		var expectedFileCreations = {};
		var sendNewFiles = (function() {
			function sendNewFiles() {
				expectedFileCreations = {};
				clFileSvc.files.filter(isFilePendingCreation).forEach(function(fileDao) {
					expectedFileCreations[fileDao.id] = true;
					fileDao.loadExecUnload(function() {
						clSocketSvc.sendMsg({
							type: 'createFile',
							id: fileDao.id,
							txt: fileDao.contentDao.txt || '\n',
							properties: fileDao.contentDao.properties || {}
						});
						lastCreateFileActivity = Date.now();
					});
				});
			}

			clSocketSvc.addMsgHandler('createdFile', function(msg, ctx) {
				if (readSyncDataStore(ctx)) {
					return;
				}
				lastCreateFileActivity = Date.now();
				delete expectedFileCreations[msg.id];
				syncDataStore.files[msg.id] = {
					r: -1
				};
				msg.rev && contentRevStore.setRev(msg.id, msg.rev);
				writeSyncDataStore();
			});

			return sendNewFiles;
		})();


		/******
		Content
		******/

		var watchCtx;

		function setWatchCtx(ctx) {
			watchCtx = ctx;
			clSyncSvc.watchCtx = ctx;
		}
		var unsetWatchCtx = setWatchCtx.bind(undefined, undefined);
		clSocketSvc.addMsgHandler('userToken', unsetWatchCtx);

		function setLoadedContent(fileDao, serverContent) {
			fileDao.contentDao.txt = serverContent.txt;
			fileDao.contentDao.properties = serverContent.properties;
			fileDao.contentDao.isLocal = '1';
			fileDao.contentDao.discussions = {};
			fileDao.contentDao.state = {};
			fileDao.writeContent(true);
			fileDao.state = 'loaded';
			if (!clFileSvc.fileMap.hasOwnProperty(fileDao.id)) {
				clFileSvc.fileMap[fileDao.id] = fileDao;
				clFileSvc.fileIds.push(fileDao.id);
			}
			clFileSvc.init();
		}

		function setLoadingError(fileDao, error) {
			if (fileDao.state === 'loading') {
				fileDao.state = undefined;
			}
			clToast(error || 'The file is not accessible.');
		}

		function getServerContent(content, contentChanges) {
			return {
				txt: contentChanges.reduce(function(serverTxt, contentChange) {
					return clSyncUtils.applyTxtPatches(serverTxt, contentChange.txt || []);
				}, content.txt),
				properties: contentChanges.reduce(function(serverProperties, contentChange) {
					return clSyncUtils.applyPropertiesPatches(serverProperties, contentChange.properties || []);
				}, content.properties),
				rev: content.rev + contentChanges.length
			};
		}

		function applyServerContent(fileDao, oldContent, serverContent) {
			var oldTxt = oldContent.txt;
			var serverTxt = serverContent.txt;
			var localTxt = clEditorSvc.cledit.getContent();
			var isServerTxtChanges = oldTxt !== serverTxt;
			var isLocalTxtChanges = oldTxt !== localTxt;
			var isTxtSynchronized = serverTxt === localTxt;
			if (!isTxtSynchronized && isServerTxtChanges && isLocalTxtChanges) {
				// TODO Deal with conflict
				clEditorSvc.setContent(serverTxt, true);
			} else if (!isTxtSynchronized && isServerTxtChanges) {
				clEditorSvc.setContent(serverTxt, true);
			}
			var valueHash = {},
				valueArray = [];
			// Hash local object first to preserve Angular indexes
			var localPropertiesHash = clSyncUtils.hashObject(fileDao.contentDao.properties, valueHash, valueArray);
			var oldPropertiesHash = clSyncUtils.hashObject(oldContent.properties, valueHash, valueArray);
			var serverPropertiesHash = clSyncUtils.hashObject(serverContent.properties, valueHash, valueArray);
			if (oldPropertiesHash !== localPropertiesHash) {
				localPropertiesHash = clSyncUtils.quickPatch(oldPropertiesHash, serverPropertiesHash, localPropertiesHash);
				fileDao.contentDao.properties = clSyncUtils.unhashObject(localPropertiesHash, valueArray);
			} else {
				fileDao.contentDao.properties = serverContent.properties;
			}
		}

		function startWatchFile(fileDao) {
			if (!fileDao || !fileDao.state || fileDao.isReadOnly || isFilePendingCreation(fileDao) || (watchCtx && fileDao === watchCtx.fileDao)) {
				return;
			}
			fileDao.loadPending = false;
			setWatchCtx({
				fileDao: fileDao,
				rev: contentRevStore.getRev(fileDao.id),
				userActivities: {},
				contentChanges: []
			});
			clSocketSvc.sendMsg({
				type: 'startWatchFile',
				id: fileDao.id,
				userId: fileDao.userId || undefined,
				from: watchCtx.rev
			});
			$timeout.cancel(fileDao.loadingTimeoutId);
			fileDao.loadingTimeoutId = $timeout(function() {
				setLoadingError(fileDao, 'Loading timeout.');
			}, loadingTimeout);
		}

		function stopWatchFile() {
			if (watchCtx && watchCtx.fileDao) {
				clSocketSvc.sendMsg({
					type: 'stopWatchFile'
				});
				unsetWatchCtx();
			}
		}

		clSocketSvc.addMsgHandler('watchFile', function(msg) {
			if (!watchCtx || !watchCtx.fileDao.state || watchCtx.fileDao.id !== msg.id) {
				return;
			}
			var fileDao = watchCtx.fileDao;
			$timeout.cancel(fileDao.loadingTimeoutId);
			if (msg.error) {
				return setLoadingError(fileDao);
			}
			if (fileDao.userId) {
				updateExtFileMetadata(fileDao, msg);
			}
			var apply, serverContent = getServerContent(msg.content, msg.contentChanges || []);
			if (fileDao.state === 'loading') {
				setLoadedContent(fileDao, serverContent);
				apply = true;
			} else {
				applyServerContent(fileDao, msg.content, serverContent);
			}
			watchCtx.txt = serverContent.txt;
			watchCtx.properties = serverContent.properties;
			watchCtx.rev = serverContent.rev;
			contentRevStore.setRev(fileDao.id, serverContent.rev);
			// Evaluate scope synchronously to have cledit instantiated
			apply && $rootScope.$apply();
		});

		function getPublicFile(fileDao) {
			if (!fileDao || !fileDao.state || !fileDao.loadPending || !fileDao.userId || $window.navigator.onLine === false) {
				return;
			}
			fileDao.loadPending = false;
			var fromRev = contentRevStore.getRev(fileDao.id);
			$http.get('/api/users/' + fileDao.userId + '/files/' + fileDao.id + (fromRev ? '/from/' + fromRev : ''), {
					timeout: loadingTimeout
				})
				.success(function(res) {
					updateExtFileMetadata(fileDao, res);
					if (!fileDao.state) {
						return;
					}
					var serverContent = getServerContent(res.content, res.contentChanges || []);
					if (fileDao.state === 'loading') {
						setLoadedContent(fileDao, serverContent);
					} else {
						applyServerContent(fileDao, res.content, serverContent);
					}
					contentRevStore.setRev(fileDao.id, serverContent.rev);
				})
				.error(function() {
					setLoadingError(fileDao);
				});
		}


		/**************
		Content changes
		**************/

		function sendContentChange() {
			if (!watchCtx || watchCtx.txt === undefined || watchCtx.sentMsg) {
				return;
			}
			// if(watchCtx.fileDao.userId && (watchCtx.fileDao.sharing !== 'rw' || clUserSvc.user.plan !== 'premium')) {
			if (watchCtx.fileDao.userId && watchCtx.fileDao.sharing !== 'rw') {
				return;
			}
			var txtChanges = clSyncUtils.getTxtPatches(watchCtx.txt, clEditorSvc.cledit.getContent());
			txtChanges = txtChanges.length ? txtChanges : undefined;
			var propertiesChanges = clSyncUtils.getPropertiesPatches(watchCtx.properties, watchCtx.fileDao.contentDao.properties);
			propertiesChanges = propertiesChanges.length ? propertiesChanges : undefined;
			if (!txtChanges && !propertiesChanges) {
				return;
			}
			var newRev = watchCtx.rev + 1;
			watchCtx.sentMsg = {
				type: 'setContentChange',
				rev: newRev,
				txt: txtChanges,
				properties: propertiesChanges
			};
			clSocketSvc.sendMsg(watchCtx.sentMsg);
		}

		clSocketSvc.addMsgHandler('contentChange', function(msg) {
			if (!watchCtx || watchCtx.fileDao.id !== msg.id || watchCtx.rev >= msg.rev) {
				return;
			}
			watchCtx.contentChanges[msg.rev] = msg;
			var serverTxt = watchCtx.txt;
			var localTxt = clEditorSvc.cledit.getContent();
			var serverProperties = watchCtx.properties;
			while ((msg = watchCtx.contentChanges[watchCtx.rev + 1])) {
				watchCtx.rev = msg.rev;
				watchCtx.contentChanges[msg.rev] = undefined;
				if (!msg.userId && watchCtx.sentMsg && msg.rev === watchCtx.sentMsg.rev) {
					// This has to be the previously sent message
					msg = watchCtx.sentMsg;
				}
				var oldTxt = serverTxt;
				serverTxt = clSyncUtils.applyTxtPatches(serverTxt, msg.txt || []);
				serverProperties = clSyncUtils.applyPropertiesPatches(serverProperties, msg.properties || []);
				if (msg !== watchCtx.sentMsg) {
					var isServerTxtChanges = oldTxt !== serverTxt;
					var isLocalTxtChanges = oldTxt !== localTxt;
					var isTxtSynchronized = serverTxt === localTxt;
					if (!isTxtSynchronized && isServerTxtChanges) {
						if (isLocalTxtChanges) {
							localTxt = clSyncUtils.quickPatch(oldTxt, serverTxt, localTxt);
						} else {
							localTxt = serverTxt;
						}
						var offset = clEditorSvc.setContent(localTxt, true);
						var userActivity = watchCtx.userActivities[msg.userId] || {};
						userActivity.offset = offset;
						watchCtx.userActivities[msg.userId] = userActivity;
					}
					clUserInfoSvc.request(msg.userId);
				}
				watchCtx.sentMsg = undefined;
			}
			var valueHash = {},
				valueArray = [];
			// Hash local object first to preserve Angular indexes
			var localPropertiesHash = clSyncUtils.hashObject(watchCtx.fileDao.contentDao.properties, valueHash, valueArray);
			var oldPropertiesHash = clSyncUtils.hashObject(watchCtx.properties, valueHash, valueArray);
			var serverPropertiesHash = clSyncUtils.hashObject(serverProperties, valueHash, valueArray);
			var isServerPropertiesChanges = oldPropertiesHash !== serverPropertiesHash;
			var isLocalPropertiesChanges = oldPropertiesHash !== localPropertiesHash;
			var isPropertiesSynchronized = serverPropertiesHash === localPropertiesHash;
			if (!isPropertiesSynchronized && isServerPropertiesChanges) {
				if (isLocalPropertiesChanges) {
					localPropertiesHash = clSyncUtils.quickPatch(oldPropertiesHash, serverPropertiesHash, localPropertiesHash);
				} else {
					localPropertiesHash = serverPropertiesHash;
				}
				watchCtx.fileDao.contentDao.properties = clSyncUtils.unhashObject(localPropertiesHash, valueArray);
			}
			watchCtx.txt = serverTxt;
			watchCtx.properties = serverProperties;
			contentRevStore.setRev(watchCtx.fileDao.id, watchCtx.rev);
		});

		clSyncSvc.saveAll = function() {
			return clUserSvc.checkAll() |
				clFileSvc.checkAll() |
				clFolderSvc.checkAll() |
				clClasseurSvc.checkAll() |
				clSettingSvc.checkAll();
		};

		clSetInterval(function() {
			readSyncDataStore(clSocketSvc.ctx);
			// Need to save here to make sure we have `updated` attributes up to date
			var applyScope = clSyncSvc.saveAll();
			// Remove files that are not local and not going to be synced
			var filesToRemove = clFileSvc.files.filter(function(fileDao) {
				return !fileDao.userId && !fileDao.contentDao.isLocal && !syncDataStore.files.hasOwnProperty(fileDao.id);
			});
			filesToRemove.length && clFileSvc.removeFiles(filesToRemove);
			(applyScope || filesToRemove.length) && $rootScope.$apply();
			if (!clUserActivity.isActive() || !clSocketSvc.isOnline()) {
				return;
			}
			if (Date.now() - syncDataStore.lastActivity > maxSyncInactivity) {
				// Retrieve and send files/folders modifications
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
		}, 1100);

		$rootScope.$watch('currentFileDao', function(currentFileDao) {
			if (currentFileDao) {
				currentFileDao.loadPending = true;
			}
			if (clSocketSvc.isOnline()) {
				readSyncDataStore(clSocketSvc.ctx);
				stopWatchFile();
				startWatchFile(currentFileDao);
			} else if (!clSocketSvc.hasToken) {
				getPublicFile(currentFileDao);
			}
		});

		clSetInterval(function() {
			if (!clUserActivity.isActive()) {
				return;
			}
			var currentFileDao = $rootScope.currentFileDao;
			if (clSocketSvc.isOnline()) {
				if (readSyncDataStore(clSocketSvc.ctx)) {
					stopWatchFile();
				}
				startWatchFile(currentFileDao);
				sendContentChange();
			} else if (!clSocketSvc.hasToken) {
				getPublicFile(currentFileDao);
			}
		}, 250);

		return clSyncSvc;
	})
	.factory('clSyncUtils', function($window) {
		var diffMatchPatch = new $window.diff_match_patch();
		var DIFF_DELETE = -1;
		var DIFF_INSERT = 1;
		var DIFF_EQUAL = 0;

		function getTxtPatches(oldTxt, newTxt) {
			var diffs = diffMatchPatch.diff_main(oldTxt, newTxt);
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
							o: startOffset,
							d: changeText
						});
						break;
					case DIFF_INSERT:
						patches.push({
							o: startOffset,
							a: changeText
						});
						startOffset += changeText.length;
						break;
				}
			});
			return patches;
		}

		function getPropertiesPatches(oldProperties, newProperties) {
			var valueHash = {},
				valueArray = [];
			oldProperties = hashObject(oldProperties, valueHash, valueArray);
			newProperties = hashObject(newProperties, valueHash, valueArray);
			var diffs = diffMatchPatch.diff_main(oldProperties, newProperties);
			var patches = [];
			diffs.forEach(function(change) {
				var changeType = change[0];
				var changeHash = change[1];
				if (changeType === DIFF_EQUAL) {
					return;
				}
				changeHash.split('').forEach(function(objHash) {
					var obj = valueArray[objHash.charCodeAt(0)];
					var patch = {
						k: obj[0]
					};
					patch[changeType === DIFF_DELETE ? 'd' : 'a'] = obj[1];
					patches.push(patch);
				});
			});
			return patches;
		}

		function applyTxtPatches(txt, patches) {
			return patches.reduce(function(txt, patch) {
				if (patch.a) {
					return txt.slice(0, patch.o) + patch.a + txt.slice(patch.o);
				} else if (patch.d) {
					return txt.slice(0, patch.o) + txt.slice(patch.o + patch.d.length);
				} else {
					return txt;
				}
			}, txt);
		}

		function applyPropertiesPatches(properties, patches) {
			var result = angular.extend({}, properties);
			patches.forEach(function(patch) {
				if (patch.a) {
					result[patch.k] = patch.a;
				} else if (patch.d) {
					delete result[patch.k];
				}
			});
			return result;
		}

		function quickPatch(oldStr, newStr, destStr) {
			var diffs = diffMatchPatch.diff_main(oldStr, newStr);
			var patches = diffMatchPatch.patch_make(oldStr, diffs);
			var patchResult = diffMatchPatch.patch_apply(patches, destStr);
			return patchResult[0];
		}

		function hashArray(arr, valueHash, valueArray) {
			var hash = [];
			arr.forEach(function(obj) {
				var serializedObj = JSON.stringify(obj);
				var objHash;
				if (!valueHash.hasOwnProperty(serializedObj)) {
					objHash = valueArray.length;
					valueArray.push(obj);
					valueHash[serializedObj] = objHash;
				} else {
					objHash = valueHash[serializedObj];
				}
				hash.push(objHash);
			});
			return String.fromCharCode.apply(null, hash);
		}

		function unhashArray(hash, valueArray) {
			return hash.split('').map(function(objHash) {
				return valueArray[objHash.charCodeAt(0)];
			});
		}

		function hashObject(obj, valueHash, valueArray) {
			return hashArray(Object.keys(obj || {}).sort().map(function(key) {
				return [key, obj[key]];
			}), valueHash, valueArray);
		}

		function unhashObject(hash, valueArray) {
			var result = {};
			unhashArray(hash, valueArray).forEach(function(value) {
				result[value[0]] = value[1];
			});
			return result;
		}

		return {
			getTxtPatches: getTxtPatches,
			getPropertiesPatches: getPropertiesPatches,
			applyTxtPatches: applyTxtPatches,
			applyPropertiesPatches: applyPropertiesPatches,
			quickPatch: quickPatch,
			hashArray: hashArray,
			unhashArray: unhashArray,
			hashObject: hashObject,
			unhashObject: unhashObject,
		};
	});
