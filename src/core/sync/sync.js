angular.module('classeur.core.sync', [])
	.factory('clSyncDataSvc',
		function(clLocalStorage, clLocalStorageObject, clFileSvc, clFolderSvc, clSocketSvc) {
			var cleanPublicObjectAfter = 86400000; // 1 day

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

			var clSyncDataSvc = clLocalStorageObject('syncData', {
				lastActivity: 'int',
				folders: {
					default: '{}',
					parser: parseSyncData,
					serializer: serializeSyncData,
				},
				nextFolderSeq: 'int',
				folderLastUpdated: 'int',
				files: {
					default: '{}',
					parser: parseSyncData,
					serializer: serializeSyncData,
				},
				nextFileSeq: 'int',
				fileLastUpdated: 'int',
				userId: 'string',
				userData: {
					default: '{}',
					parser: parseSyncData,
					serializer: serializeSyncData,
				},
				fileSyncReady: 'string',
				fileCreationDates: 'object',
				folderRefreshDates: 'object',
				fileRecoveryDates: 'object'
			});

			function reset() {
				var fileKeyPrefix = /^syncData\./;
				Object.keys(clLocalStorage).cl_each(function(key) {
					if (key.charCodeAt(0) === 0x73 /* s */ && key.match(fileKeyPrefix)) {
						clLocalStorage.removeItem(key);
					}
				});
				read();
			}

			var initialized;

			function checkUserChange(userId) {
				if (userId !== clSyncDataSvc.userId) {
					// Add userId to synced files owned by previous user
					var filesToRemove = clFileSvc.files.cl_filter(function(fileDao) {
						if (!fileDao.userId && clSyncDataSvc.files.hasOwnProperty(fileDao.id)) {
							fileDao.userId = clSyncDataSvc.userId;
							return !fileDao.contentDao.isLocal;
						}
					});
					// Remove files that are public and not local
					clFileSvc.removeFiles(filesToRemove);
					// Remove files that are pending for deletion
					clFileSvc.removeFiles(clFileSvc.deletedFiles);
					clFileSvc.checkAll();

					// Add userId to synced folders owned by previous user
					clFolderSvc.folders.cl_each(function(folderDao) {
						if (!folderDao.userId && clSyncDataSvc.folders.hasOwnProperty(folderDao.id)) {
							folderDao.userId = clSyncDataSvc.userId;
						}
					});
					// Remove files that are pending for deletion
					clFolderSvc.removeFolders(clFolderSvc.deletedFolders);
					clFolderSvc.checkAll();

					reset();
					clSyncDataSvc.userId = userId;
					// Force sync
					write(1);
					return true;
				}
			}

			function read(ctx) {
				var checkSyncDataUpdate = clSyncDataSvc.$checkUpdate();
				if (initialized && !checkSyncDataUpdate) {
					return;
				}

				clSyncDataSvc.$read();
				clSyncDataSvc.$readUpdate();

				if (!initialized) {
					var currentDate = Date.now();

					// Eject old public deletedFiles from clSyncDataSvc
					clSyncDataSvc.files = clSyncDataSvc.files.cl_reduce(function(files, syncData, id) {
						var fileDao = clFileSvc.fileMap[id] || clFileSvc.deletedFileMap[id];
						if (fileDao && (!fileDao.userId || !fileDao.deleted || currentDate - fileDao.deleted < cleanPublicObjectAfter)) {
							files[id] = syncData;
						}
						return files;
					}, {});

					// Eject old public deletedFolders from clSyncDataSvc
					clSyncDataSvc.folders = clSyncDataSvc.folders.cl_reduce(function(folders, syncData, id) {
						var folderDao = clFolderSvc.folderMap[id] || clFolderSvc.deletedFolderMap[id];
						if (folderDao && (!folderDao.userId || !folderDao.deleted || currentDate - folderDao.deleted < cleanPublicObjectAfter)) {
							folders[id] = syncData;
						}
						return folders;
					}, {});

					// Eject old folderRefreshDates
					clSyncDataSvc.folderRefreshDates.cl_each(function(date, folderId) {
						if (currentDate - date > cleanPublicObjectAfter) {
							delete clSyncDataSvc.folderRefreshDates[folderId];
						}
					});

					clFileSvc.removeFiles(
						// Remove deletedFiles that are not synced anymore
						clFileSvc.deletedFiles.cl_filter(function(fileDao) {
							if (!clSyncDataSvc.files.hasOwnProperty(fileDao.id)) {
								return true;
							}
						})
						// Remove public files that are not local and not refreshed recently
						.concat(clFileSvc.files.cl_filter(function(fileDao) {
							if (fileDao.userId &&
								!fileDao.contentDao.isLocal &&
								(!fileDao.folderId || !clSyncDataSvc.folderRefreshDates.hasOwnProperty(fileDao.folderId))
							) {
								return true;
							}
						}))
					);

					// Remove deletedFolders that are not synced anymore
					clFolderSvc.removeFolders(clFolderSvc.deletedFolders.cl_filter(function(folderDao) {
						if (!clSyncDataSvc.folders.hasOwnProperty(folderDao.id)) {
							return true;
						}
					}));

					initialized = true;
				}

				return ctx && ctx.userId && checkUserChange(ctx.userId);
			}

			function write(lastActivity) {
				clSyncDataSvc.lastActivity = lastActivity || Date.now();
				clSyncDataSvc.$write();
			}

			clSocketSvc.addMsgHandler('userToken', function(msg) {
				read();
				checkUserChange(msg.userId);
			});

			function isFilePendingCreation(fileDao) {
				var isWritable = !fileDao.userId || fileDao.sharing === 'rw';
				if(!isWritable) {
					var folderDao = clFolderSvc.folderMap[fileDao.folderId];
					isWritable = folderDao && folderDao.sharing === 'rw';
				}
				return isWritable && fileDao.contentDao.isLocal && !clSyncDataSvc.files.hasOwnProperty(fileDao.id);
			}

			function updatePublicFileMetadata(fileDao, metadata) {
				fileDao.refreshed = Date.now();
				var syncData = clSyncDataSvc.files[fileDao.id] || {};
				if (metadata.updated) {
					// File permission can change without metadata update
					if ((metadata.updated !== syncData.r && metadata.updated !== syncData.s) || fileDao.sharing !== metadata.permission) {
						fileDao.name = metadata.name || '';
						// For public files we take the permission as the file sharing
						fileDao.sharing = metadata.permission || '';
						fileDao.updated = metadata.updated;
						fileDao.userId = clSyncDataSvc.userId !== metadata.userId ? metadata.userId : '';
						fileDao.write(fileDao.updated);
					}
					syncData.r = metadata.updated;
					clSyncDataSvc.files[fileDao.id] = syncData;
				}
			}

			function updatePublicFolderMetadata(folderDao, metadata) {
				var syncData = clSyncDataSvc.folders[folderDao.id] || {};
				if (metadata.updated && metadata.updated !== syncData.r && metadata.updated !== syncData.s) {
					folderDao.name = metadata.name || '';
					folderDao.sharing = metadata.sharing || '';
					folderDao.updated = metadata.updated;
					folderDao.userId = clSyncDataSvc.userId !== metadata.userId ? metadata.userId : '';
					folderDao.write(folderDao.updated);
				}
				syncData.r = metadata.updated;
				clSyncDataSvc.folders[folderDao.id] = syncData;
			}

			clSyncDataSvc.read = read;
			clSyncDataSvc.write = write;
			clSyncDataSvc.isFilePendingCreation = isFilePendingCreation;
			clSyncDataSvc.updatePublicFileMetadata = updatePublicFileMetadata;
			clSyncDataSvc.updatePublicFolderMetadata = updatePublicFolderMetadata;
			clSyncDataSvc.loadingTimeout = 30 * 1000; // 30 sec

			read();
			return clSyncDataSvc;
		})
	.factory('clContentRevSvc',
		function(clLocalStorage, clFileSvc, clDiffUtils, clHash) {
			var contentRevKeyPrefix = 'cr.';
			var contentHashKeyPrefix = 'ch.';

			var fileKeyPrefix = /^c[rh]\.(\w\w+)/;
			Object.keys(clLocalStorage).cl_each(function(key) {
				if (key.charCodeAt(0) === 0x63 /* c */ ) {
					var match = key.match(fileKeyPrefix);
					if (match) {
						if (!clFileSvc.fileMap[match[1]] || !clFileSvc.fileMap[match[1]].contentDao.isLocal) {
							clLocalStorage.removeItem(key);
						}
					}
				}
			});

			function getContentHash(content) {
				var serializedContent = clDiffUtils.serializeObject({
					text: content.text,
					properties: content.properties,
					discussions: content.discussions,
					comments: content.comments,
					conflicts: content.conflicts,
				});
				return clHash(serializedContent);
			}

			function getLocalStorageInt(key) {
				var value = parseInt(clLocalStorage.getItem(key));
				return isNaN(value) ? undefined : value;
			}

			return {
				setContent: function(fileId, content) {
					clLocalStorage.setItem(contentRevKeyPrefix + fileId, content.rev);
					clLocalStorage.setItem(contentHashKeyPrefix + fileId, getContentHash(content));
				},
				getRev: function(fileId) {
					return getLocalStorageInt(contentRevKeyPrefix + fileId);
				},
				isServerContent: function(fileId, content) {
					var localHash = getContentHash(content);
					var serverHash = getLocalStorageInt(contentHashKeyPrefix + fileId);
					return localHash === serverHash;
				}
			};
		})
	.factory('clSyncSvc',
		function($rootScope, $location, $http, clIsNavigatorOnline, clToast, clUserSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clLocalSettingSvc, clSocketSvc, clUserActivity, clSetInterval, clSyncDataSvc, clContentRevSvc) {
			var clSyncSvc = {};
			var nameMaxLength = 128;
			var longInactivityThreshold = 60 * 1000; // 60 sec
			var shortInactivityThreshold = 10 * 1000; // 10 sec
			var createFileTimeout = 30 * 1000; // 30 sec
			var recoverFileTimeout = 30 * 1000; // 30 sec


			/***
			User
			***/

			var syncUser = (function() {

				function retrieveChanges() {
					clSocketSvc.sendMsg({
						type: 'getUserData',
						userUpdated: clUserSvc.user && (clSyncDataSvc.userData.user || {}).r,
						classeursUpdated: (clSyncDataSvc.userData.classeurs || {}).r,
						settingsUpdated: (clSyncDataSvc.userData.settings || {}).r
					});
				}

				clSocketSvc.addMsgHandler('userData', function(msg, ctx) {
					if (clSyncDataSvc.read(ctx)) {
						return;
					}
					var apply, syncData;
					if (msg.user) {
						syncData = clSyncDataSvc.userData.user || {};
						if (syncData.s !== msg.userUpdated) {
			                clUserSvc.user = msg.user;
							clUserSvc.write(msg.userUpdated);
							apply = true;
						}
						clSyncDataSvc.userData.user = {
							r: msg.userUpdated
						};
					}
					if (msg.classeurs) {
						syncData = clSyncDataSvc.userData.classeurs || {};
						if (syncData.s !== msg.classeursUpdated) {
							clClasseurSvc.init(msg.classeurs);
							clClasseurSvc.write(msg.classeursUpdated);
							apply = true;
						}
						clSyncDataSvc.userData.classeurs = {
							r: msg.classeursUpdated
						};
						getPublicFoldersMetadata();
					}
					if (msg.settings) {
						syncData = clSyncDataSvc.userData.settings || {};
						if (syncData.s !== msg.settingsUpdated) {
							clSettingSvc.updateSettings(msg.settings);
							clSettingSvc.write(msg.settingsUpdated);
							apply = true;
						}
						clSyncDataSvc.userData.settings = {
							r: msg.settingsUpdated
						};
					}
					apply && $rootScope.$evalAsync();
					sendChanges();
					clSyncDataSvc.write();
				});

				function sendChanges() {
					var syncData, msg = {
						type: 'setUserData'
					};
					syncData = clSyncDataSvc.userData.user || {};
					if (clUserSvc.updated !== syncData.r) {
						msg.user = {
							name: (clUserSvc.user || {}).name,
						};
						msg.userUpdated = clUserSvc.updated;
						syncData.s = clUserSvc.updated;
						clSyncDataSvc.userData.user = syncData;
					}
					syncData = clSyncDataSvc.userData.classeurs || {};
					if (clClasseurSvc.updated !== syncData.r) {
						msg.classeurs = clClasseurSvc.classeurs.cl_map(function(classeurDao) {
							return classeurDao.toStorable();
						});
						msg.classeursUpdated = clClasseurSvc.updated;
						syncData.s = clClasseurSvc.updated;
						clSyncDataSvc.userData.classeurs = syncData;
					}
					syncData = clSyncDataSvc.userData.settings || {};
					if (clSettingSvc.updated !== syncData.r) {
						msg.settings = clSettingSvc.values;
						msg.settingsUpdated = clSettingSvc.updated;
						syncData.s = clSettingSvc.updated;
						clSyncDataSvc.userData.settings = syncData;
					}
					Object.keys(msg).length > 1 && clSocketSvc.sendMsg(msg);
				}

				return retrieveChanges;
			})();


			/******
			Folders
			******/

			function getPublicFoldersMetadata() {
				var foldersToRefresh = clFolderSvc.folders.cl_filter(function(folderDao) {
					return folderDao.userId && !folderDao.name;
				});
				if (!foldersToRefresh.length || !clIsNavigatorOnline()) {
					return;
				}
				$http.get('/api/v1/metadata/folders', {
						timeout: clSyncDataSvc.loadingTimeout,
						params: {
							id: foldersToRefresh.cl_map(function(folderDao) {
								return folderDao.id;
							}).join(','),
						}
					})
					.success(function(res) {
						res.cl_each(function(item) {
							var folderDao = clFolderSvc.folderMap[item.id];
							if (folderDao) {
								clSyncDataSvc.updatePublicFolderMetadata(folderDao, item);
							}
						});
						clFolderSvc.init(); // Refresh tabs order
					});
			}

			var syncFolders = (function() {

				function retrieveChanges() {
					clSocketSvc.sendMsg({
						type: 'getFolderChanges',
						nextSeq: clSyncDataSvc.nextFolderSeq
					});
				}

				clSocketSvc.addMsgHandler('folderChanges', function(msg, ctx) {
					if (clSyncDataSvc.read(ctx)) {
						return;
					}
					var apply = clFolderSvc.checkAll(true);
					var foldersToUpdate = [];
					(msg.changes || []).cl_each(function(change) {
						var folderDao = clFolderSvc.folderMap[change.id];
						var syncData = clSyncDataSvc.folders[change.id] || {};
						if (
							// Has been deleted on the server
							(change.deleted && folderDao) ||
							// Has been created on the server and is not pending for deletion locally
							(!change.deleted && !folderDao && !clFolderSvc.deletedFolderMap[change.id]) ||
							// Has been updated on the server and is different from local
							(folderDao && folderDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
						) {
							foldersToUpdate.push(change);
						}
						if (change.deleted) {
							delete clSyncDataSvc.folders[change.id];
						} else {
							clSyncDataSvc.folders[change.id] = {
								r: change.updated
							};
						}
					});
					if (foldersToUpdate.length) {
						clFolderSvc.updateUserFolders(foldersToUpdate);
						apply = true;
					}
					clSyncDataSvc.nextFolderSeq = msg.nextSeq || clSyncDataSvc.nextFolderSeq;
					if (msg.hasMore) {
						retrieveChanges();
					} else {
						// Sync user's classeurs once all folders are synced
						syncUser();
						sendChanges();
					}
					clSyncDataSvc.write();
					apply && $rootScope.$evalAsync();
				});

				function checkUpdated(folderDao, syncData) {
					if (folderDao.name && folderDao.updated &&
						folderDao.updated != syncData.r &&
						(!folderDao.userId || (folderDao.sharing === 'rw' && folderDao.updated != syncData.s))
					) {
						if (folderDao.name.length > nameMaxLength) {
							folderDao.name = folderDao.name.slice(0, nameMaxLength);
						} else {
							return true;
						}
					}
				}

				function sendChanges() {
					clFolderSvc.folders.cl_each(function(folderDao) {
						var syncData = clSyncDataSvc.folders[folderDao.id] || {};
						if (checkUpdated(folderDao, syncData)) {
							clSocketSvc.sendMsg({
								type: 'setFolderMetadata',
								id: folderDao.id,
								name: folderDao.name,
								sharing: folderDao.sharing || undefined,
								updated: folderDao.updated
							});
							syncData.s = folderDao.updated;
							clSyncDataSvc.folders[folderDao.id] = syncData;
						}
					});
					clFolderSvc.deletedFolders.cl_each(function(folderDao) {
						var syncData = clSyncDataSvc.folders[folderDao.id];
						// Folder has been synchronized
						if (syncData && checkUpdated(folderDao, syncData)) {
							clSocketSvc.sendMsg({
								type: 'deleteFolder',
								id: folderDao.id
							});
							syncData.s = folderDao.updated;
						}
					});
					clSyncDataSvc.folderLastUpdated = clFolderSvc.getLastUpdated();
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
						nextSeq: clSyncDataSvc.nextFileSeq
					});
				}

				clSocketSvc.addMsgHandler('fileChanges', function(msg, ctx) {
					if (clSyncDataSvc.read(ctx)) {
						return;
					}
					var apply = clFileSvc.checkAll(true);
					var filesToUpdate = [];
					(msg.changes || []).cl_each(function(change) {
						var fileDao = clFileSvc.fileMap[change.id];
						var syncData = clSyncDataSvc.files[change.id] || {};
						if (
							// Has been deleted on the server and ownership was not changed
							(change.deleted && fileDao && !fileDao.userId) ||
							// Has been created on the server and is not pending for deletion locally
							(!change.deleted && !fileDao && !clFileSvc.deletedFileMap[change.id]) ||
							// Has been updated on the server and is different from local
							(fileDao && fileDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated)
						) {
							filesToUpdate.push(change);
						}
						if (change.deleted) {
							delete clSyncDataSvc.files[change.id];
						} else {
							clSyncDataSvc.files[change.id] = {
								r: change.updated
							};
						}
					});
					if (filesToUpdate.length) {
						clFileSvc.updateUserFiles(filesToUpdate);
						apply = true;
					}
					clSyncDataSvc.nextFileSeq = msg.nextSeq || clSyncDataSvc.nextFileSeq;
					if (msg.hasMore) {
						retrieveChanges();
					} else {
						sendChanges();
					}
					clSyncDataSvc.write();
					apply && $rootScope.$evalAsync();
				});

				function checkUpdated(fileDao, syncData) {
					if (fileDao.name && fileDao.updated &&
						fileDao.updated != syncData.r &&
						(!fileDao.userId || (fileDao.sharing === 'rw' && fileDao.updated != syncData.s))
					) {
						if (fileDao.name.length > nameMaxLength) {
							fileDao.name = fileDao.name.slice(0, nameMaxLength);
						} else {
							return true;
						}
					}
				}

				function sendChanges() {
					clFileSvc.files.cl_each(function(fileDao) {
						var syncData = clSyncDataSvc.files[fileDao.id] || {};
						// File has been created
						if (syncData.r && checkUpdated(fileDao, syncData)) {
							clSocketSvc.sendMsg({
								type: 'setFileMetadata',
								id: fileDao.id,
								name: fileDao.name,
								folderId: fileDao.folderId || undefined,
								sharing: fileDao.sharing || undefined,
								updated: fileDao.updated
							});
							syncData.s = fileDao.updated;
							clSyncDataSvc.files[fileDao.id] = syncData;
						}
					});
					clFileSvc.deletedFiles.cl_each(function(fileDao) {
						var syncData = clSyncDataSvc.files[fileDao.id];
						// File has been synchronized
						if (syncData && checkUpdated(fileDao, syncData) && !clSyncDataSvc.fileRecoveryDates.hasOwnProperty(fileDao.id)) {
							clSocketSvc.sendMsg({
								type: 'setFileMetadata',
								id: fileDao.id,
								name: fileDao.name,
								folderId: fileDao.folderId || undefined,
								sharing: fileDao.sharing || undefined,
								updated: fileDao.updated,
								deleted: fileDao.deleted
							});
							syncData.s = fileDao.updated;
						}
					});
					clSyncDataSvc.fileLastUpdated = clFileSvc.getLastUpdated();
					clSyncDataSvc.fileSyncReady = '1';
				}

				return retrieveChanges;
			})();

			clSyncSvc.recoverFile = function(file) {
				var currentDate = Date.now();
				clSyncDataSvc.fileRecoveryDates[file.id] = currentDate;
				if (!clFileSvc.fileMap[file.id]) {
					clSocketSvc.sendMsg({
						type: 'setFileMetadata',
						id: file.id,
						name: file.name,
						folderId: file.folderId || undefined,
						sharing: file.sharing || undefined,
						updated: currentDate
					});
				}
			};


			/********
			New files
			********/

			var sendNewFiles = (function() {
				function sendNewFiles() {
					var currentDate = Date.now();
					Object.keys(clSyncDataSvc.fileCreationDates).cl_each(function(fileId) {
						if (clSyncDataSvc.fileCreationDates[fileId] + createFileTimeout < currentDate) {
							delete clSyncDataSvc.fileCreationDates[fileId];
						}
					});
					clFileSvc.files.cl_filter(function(fileDao) {
						return clSyncDataSvc.isFilePendingCreation(fileDao) && !clSyncDataSvc.fileCreationDates.hasOwnProperty(fileDao.id);
					}).cl_each(function(fileDao) {
						clSyncDataSvc.fileCreationDates[fileDao.id] = currentDate;
						fileDao.loadExecUnload(function() {
							clSocketSvc.sendMsg({
								type: 'createFile',
								id: fileDao.id,
								name: fileDao.name,
								folderId: fileDao.folderId || undefined,
								sharing: fileDao.sharing || undefined,
								updated: fileDao.updated,
								content: {
									text: fileDao.contentDao.text || '\n',
									properties: fileDao.contentDao.properties || {},
									discussions: fileDao.contentDao.discussions || {},
									comments: fileDao.contentDao.comments || {},
									conflicts: fileDao.contentDao.conflicts || {},
								}
							});
						});
					});
				}

				clSocketSvc.addMsgHandler('createdFile', function(msg, ctx) {
					if (clSyncDataSvc.read(ctx)) {
						return;
					}
					delete clSyncDataSvc.fileCreationDates[msg.id];
					var fileDao = clFileSvc.fileMap[msg.id];
					if (!fileDao) {
						return;
					}
					fileDao.folderId = msg.folderId || '';
					if (msg.userId) {
						fileDao.userId = msg.userId !== clSyncDataSvc.userId ? msg.userId : '';
					} else {
						// Was an existing file from another user
						fileDao.userId = '0';
					}
					fileDao.write();
					clSyncDataSvc.files[msg.id] = {
						r: msg.updated
					};
					if (msg.content) {
						clContentRevSvc.setContent(msg.id, msg.content);
					}
					clSyncDataSvc.write(clSyncDataSvc.lastActivity);
				});

				return sendNewFiles;
			})();

			clSyncSvc.saveAll = function() {
				return clUserSvc.checkAll() |
					clFileSvc.checkAll() |
					clFolderSvc.checkAll() |
					clClasseurSvc.checkAll() |
					clSettingSvc.checkAll() |
					clLocalSettingSvc.checkAll();
			};

			clSetInterval(function() {
				clSyncDataSvc.read(clSocketSvc.ctx);

				// Need to save here to have the `updated` attributes up to date
				clSyncSvc.saveAll() && $rootScope.$apply();

				if (!clUserActivity.checkActivity() || !clSocketSvc.isOnline()) {
					return;
				}

				var currentDate = Date.now();

				clSyncDataSvc.fileRecoveryDates.cl_each(function(date, fileId) {
					if (currentDate - date > recoverFileTimeout) {
						delete clSyncDataSvc.fileRecoveryDates[fileId];
					}
				});

				var inactivityThreshold = longInactivityThreshold;
				var userSyncData = clSyncDataSvc.userData.user || {};
				var classeursSyncData = clSyncDataSvc.userData.classeurs || {};
				var settingsSyncData = clSyncDataSvc.userData.settings || {};
				if (
					clSyncDataSvc.fileLastUpdated !== clFileSvc.getLastUpdated() ||
					clSyncDataSvc.folderLastUpdated !== clFolderSvc.getLastUpdated() ||
					(clUserSvc.updated !== userSyncData.r && clUserSvc.updated !== userSyncData.s) ||
					(clClasseurSvc.updated !== classeursSyncData.r && clClasseurSvc.updated !== classeursSyncData.s) ||
					(clSettingSvc.updated !== settingsSyncData.r && clSettingSvc.updated !== settingsSyncData.s)
				) {
					inactivityThreshold = shortInactivityThreshold;
				}

				if (currentDate - clSyncDataSvc.lastActivity > inactivityThreshold) {
					// Retrieve and send files/folders modifications
					syncFolders();
					syncFiles();
					clSyncDataSvc.write();
				}

				// Send new files
				if (clSyncDataSvc.fileSyncReady) {
					sendNewFiles();
				}
			}, 1100);

			return clSyncSvc;
		})
	.factory('clPublicSyncSvc',
		function($http, clSyncDataSvc, clFileSvc, clFolderSvc, clToast, clIsNavigatorOnline) {
			var publicFileRefreshAfter = 60 * 1000; // 60 sec
			var lastGetExtFileAttempt = 0;

			function getLocalFiles() {
				var currentDate = Date.now();
				var filesToRefresh = clFileSvc.localFiles.cl_filter(function(fileDao) {
					return fileDao.userId && (!fileDao.refreshed || currentDate - publicFileRefreshAfter > fileDao.refreshed);
				});
				if (!filesToRefresh.length ||
					currentDate - lastGetExtFileAttempt < publicFileRefreshAfter
				) {
					return;
				}
				lastGetExtFileAttempt = currentDate;
				$http.get('/api/v1/metadata/files', {
						timeout: clSyncDataSvc.loadingTimeout,
						params: {
							id: filesToRefresh.cl_map(function(fileDao) {
								return fileDao.id;
							}).join(',')
						}
					})
					.success(function(res) {
						lastGetExtFileAttempt = 0;
						res.cl_each(function(item) {
							var fileDao = clFileSvc.fileMap[item.id];
							if (fileDao) {
								clSyncDataSvc.updatePublicFileMetadata(fileDao, item);
								!item.updated && clToast('File not accessible: ' + (fileDao.name || fileDao.id));
							}
						});
					});
			}

			function getPublicFolder(folderDao) {
				if (!folderDao || !folderDao.userId ||
					(folderDao.refreshed && Date.now() - folderDao.refreshed < publicFileRefreshAfter)
				) {
					return;
				}
				$http.get('/api/v1/folders/' + folderDao.id, {
						timeout: clSyncDataSvc.loadingTimeout
					})
					.success(function(res) {
						var currentDate = Date.now();
						clSyncDataSvc.folderRefreshDates[folderDao.id] = currentDate;
						folderDao.refreshed = currentDate;
						clSyncDataSvc.updatePublicFolderMetadata(folderDao, res);
						var filesToMove = {};
						clFileSvc.files.cl_each(function(fileDao) {
							if (fileDao.folderId === folderDao.id) {
								filesToMove[fileDao.id] = fileDao;
							}
						});
						res.files.cl_each(function(item) {
							delete filesToMove[item.id];
							var fileDao = clFileSvc.fileMap[item.id];
							if (!fileDao) {
								fileDao = clFileSvc.createPublicFile(item.id);
								clFileSvc.fileMap[fileDao.id] = fileDao;
								clFileSvc.fileIds.push(fileDao.id);
							}
							fileDao.folderId = folderDao.id;
							clSyncDataSvc.updatePublicFileMetadata(fileDao, item);
						});
						filesToMove.cl_each(function(fileDao) {
							fileDao.folderId = '';
						});
						clFolderSvc.init(); // Refresh tabs order
						clFileSvc.init();
					})
					.error(function() {
						folderDao.refreshed = 1; // Get rid of the spinner
						clToast('Folder not accessible: ' + folderDao.name);
						!folderDao.name && clFolderSvc.removeFolders([folderDao]);
					});
			}

			return {
				getFolder: function(folderDao) {
					if (clIsNavigatorOnline()) {
						folderDao ? getPublicFolder(folderDao) : getLocalFiles();
					}
				}
			};
		})
	.factory('clContentSyncSvc',
		function($window, $rootScope, $timeout, $http, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clDiffUtils, clEditorSvc, clContentRevSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clEditorLayoutSvc) {
			var textMaxSize = 200000;
			var backgroundUpdateContentEvery = 30 * 1000; // 30 sec
			var clContentSyncSvc = {};
			var watchCtx;

			function setWatchCtx(ctx) {
				watchCtx = ctx;
				clContentSyncSvc.watchCtx = ctx;
			}
			var unsetWatchCtx = setWatchCtx.cl_bind(null, null);
			clSocketSvc.addMsgHandler('userToken', unsetWatchCtx);

			function setLoadedContent(fileDao, serverContent) {
				fileDao.contentDao.text = serverContent.text;
				fileDao.contentDao.properties = serverContent.properties || {};
				fileDao.contentDao.discussions = serverContent.discussions || {};
				fileDao.contentDao.comments = serverContent.comments || {};
				fileDao.contentDao.conflicts = serverContent.conflicts || {};
				fileDao.contentDao.isLocal = '1';
				fileDao.contentDao.state = {};
				fileDao.writeContent(true);
				fileDao.state = 'loaded';
				if (!clFileSvc.fileMap[fileDao.id]) {
					clFileSvc.fileMap[fileDao.id] = fileDao;
					clFileSvc.fileIds.push(fileDao.id);
				}
				clFileSvc.init();
			}

			function setLoadingError(fileDao, error) {
				if (fileDao.state === 'loading') {
					fileDao.state = undefined;
				}
				clToast(error || 'File not accessible: ' + (fileDao.name || fileDao.id));
			}

			function applyServerContent(fileDao, oldContent, serverContent) {
				var newContent = {
					text: clEditorSvc.cledit.getContent(),
					properties: fileDao.contentDao.properties,
					discussions: fileDao.contentDao.discussions,
					comments: fileDao.contentDao.comments,
					conflicts: fileDao.contentDao.conflicts,
				};
				var conflicts = clDiffUtils.mergeContent(oldContent, newContent, serverContent);
				fileDao.contentDao.properties = newContent.properties;
				fileDao.contentDao.discussions = newContent.discussions;
				fileDao.contentDao.comments = newContent.comments;
				fileDao.contentDao.conflicts = newContent.conflicts;
				clEditorSvc.setContent(newContent.text, true);
				if (conflicts.length) {
					conflicts.cl_each(function(conflict) {
						fileDao.contentDao.conflicts[clUid()] = conflict;
					});
					clEditorLayoutSvc.currentControl = 'conflictAlert';
				}
			}

			function startWatchFile(fileDao) {
				if (!fileDao || !fileDao.state || fileDao.isReadOnly || clSyncDataSvc.isFilePendingCreation(fileDao) || (watchCtx && fileDao === watchCtx.fileDao)) {
					return;
				}
				fileDao.loadPending = false;
				setWatchCtx({
					fileDao: fileDao,
					rev: clContentRevSvc.getRev(fileDao.id),
					userActivities: {},
					contentChanges: []
				});
				clSocketSvc.sendMsg({
					type: 'startWatchFile',
					id: fileDao.id,
					fromRev: watchCtx.rev
				});
				$timeout.cancel(fileDao.loadingTimeoutId);
				fileDao.loadingTimeoutId = $timeout(function() {
					setLoadingError(fileDao, 'Loading timeout.');
				}, clSyncDataSvc.loadingTimeout);
			}

			function stopWatchFile() {
				if (watchCtx && watchCtx.fileDao) {
					clSocketSvc.sendMsg({
						type: 'stopWatchFile'
					});
					unsetWatchCtx();
				}
			}

			clSocketSvc.addMsgHandler('watchedFile', function(msg) {
				if (!watchCtx || !watchCtx.fileDao.state || watchCtx.fileDao.id !== msg.id) {
					return;
				}
				var fileDao = watchCtx.fileDao;
				$timeout.cancel(fileDao.loadingTimeoutId);
				if (msg.error) {
					return setLoadingError(fileDao);
				}
				fileDao.userId && clSyncDataSvc.updatePublicFileMetadata(fileDao, msg);
				msg.contentChanges = msg.contentChanges || [];
				var apply = msg.contentChanges.cl_some(function(contentChange) {
					return contentChange.properties || contentChange.discussions || contentChange.comments || contentChange.conflicts;
				});
				var oldContent = clDiffUtils.flattenContent(msg.content, true);
				var serverContent = clDiffUtils.applyFlattenedContentChanges(oldContent, msg.contentChanges, true);
				if (fileDao.state === 'loading') {
					setLoadedContent(fileDao, serverContent);
					apply = true;
				} else {
					applyServerContent(fileDao, oldContent, serverContent);
				}
				watchCtx.chars = serverContent.chars;
				watchCtx.text = serverContent.text;
				watchCtx.properties = serverContent.properties;
				watchCtx.discussions = serverContent.discussions;
				watchCtx.comments = serverContent.comments;
				watchCtx.conflicts = serverContent.conflicts;
				watchCtx.rev = serverContent.rev;
				clContentRevSvc.setContent(fileDao.id, serverContent);
				// Evaluate scope synchronously to have cledit instantiated
				apply && $rootScope.$apply();
			});

			function getPublicFile(fileDao) {
				if (!fileDao || !fileDao.state || !fileDao.loadPending || !fileDao.userId || !clIsNavigatorOnline()) {
					return;
				}
				fileDao.loadPending = false;
				var fromRev = clContentRevSvc.getRev(fileDao.id);
				$http.get('/api/v1/files/' + fileDao.id + (fromRev ? '/fromRev/' + fromRev : '') + '?flatten=false', {
						timeout: clSyncDataSvc.loadingTimeout
					})
					.success(function(res) {
						clSyncDataSvc.updatePublicFileMetadata(fileDao, res);
						if (!fileDao.state) {
							return;
						}
						var oldContent = clDiffUtils.flattenContent(res.content, true);
						var serverContent = clDiffUtils.applyFlattenedContentChanges(oldContent, res.contentChanges, true);
						if (fileDao.state === 'loading') {
							setLoadedContent(fileDao, serverContent);
						} else {
							applyServerContent(fileDao, oldContent, serverContent);
						}
						clContentRevSvc.setContent(fileDao.id, serverContent);
					})
					.error(function() {
						setLoadingError(fileDao);
					});
			}

			var lastTooBigWarning = 0;

			function tooBigWarning() {
				var currentDate = Date.now();
				if (currentDate - lastTooBigWarning > 30000) {
					clToast('File is too big!');
					lastTooBigWarning = currentDate;
				}
			}

			function sendContentChange() {
				if (!watchCtx || watchCtx.text === undefined || watchCtx.sentMsg) {
					return;
				}
				if (watchCtx.fileDao.userId && (watchCtx.fileDao.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
					return;
				}
				var newText = clEditorSvc.cledit.getContent();
				if (newText.length > textMaxSize) {
					return tooBigWarning();
				}
				var textChanges = clDiffUtils.getTextPatches(watchCtx.text, newText);
				var propertiesPatches = clDiffUtils.getObjectPatches(watchCtx.properties, watchCtx.fileDao.contentDao.properties);
				var discussionsPatches = clDiffUtils.getObjectPatches(watchCtx.discussions, watchCtx.fileDao.contentDao.discussions);
				var commentsPatches = clDiffUtils.getObjectPatches(watchCtx.comments, watchCtx.fileDao.contentDao.comments);
				var conflictsPatches = clDiffUtils.getObjectPatches(watchCtx.conflicts, watchCtx.fileDao.contentDao.conflicts);
				if (!textChanges && !propertiesPatches && !discussionsPatches && !commentsPatches && !conflictsPatches) {
					return;
				}
				var newRev = watchCtx.rev + 1;
				watchCtx.sentMsg = {
					type: 'setContentChange',
					rev: newRev,
					text: textChanges,
					properties: propertiesPatches,
					discussions: discussionsPatches,
					comments: commentsPatches,
					conflicts: conflictsPatches,
				};
				clSocketSvc.sendMsg(watchCtx.sentMsg);
			}

			clSocketSvc.addMsgHandler('contentChange', function(msg) {
				if (!watchCtx || watchCtx.fileDao.id !== msg.id || watchCtx.rev >= msg.rev) {
					return;
				}
				watchCtx.contentChanges[msg.rev] = msg;
				var apply;
				var serverText = watchCtx.text;
				var localText = clEditorSvc.cledit.getContent();
				var serverProperties = watchCtx.properties;
				var serverDiscussions = watchCtx.discussions;
				var serverComments = watchCtx.comments;
				var serverConflicts = watchCtx.conflicts;
				while ((msg = watchCtx.contentChanges[watchCtx.rev + 1])) {
					watchCtx.rev = msg.rev;
					watchCtx.contentChanges[msg.rev] = undefined;
					if (!msg.userId && watchCtx.sentMsg && msg.rev === watchCtx.sentMsg.rev) {
						// It ought to be the previously sent message
						msg = watchCtx.sentMsg;
					}
					var oldText = serverText;
					watchCtx.chars = clDiffUtils.applyCharPatches(watchCtx.chars, msg.text || [], msg.userId || clSyncDataSvc.userId);
					serverText = watchCtx.chars.cl_map(function(item) {
						return item[1];
					}).join('');
					apply |= !!(msg.properties || msg.discussions || msg.comments || msg.conflicts);
					clDiffUtils.applyFlattenedObjectPatches(serverProperties, msg.properties || []);
					clDiffUtils.applyFlattenedObjectPatches(serverDiscussions, msg.discussions || []);
					clDiffUtils.applyFlattenedObjectPatches(serverComments, msg.comments || []);
					clDiffUtils.applyFlattenedObjectPatches(serverConflicts, msg.conflicts || []);
					if (msg !== watchCtx.sentMsg) {
						var isServerTextChanges = oldText !== serverText;
						var isLocalTextChanges = oldText !== localText;
						var isTextSynchronized = serverText === localText;
						if (!isTextSynchronized && isServerTextChanges) {
							if (isLocalTextChanges) {
								localText = clDiffUtils.quickPatch(oldText, serverText, localText);
							} else {
								localText = serverText;
							}
							var offset = clEditorSvc.setContent(localText, true);
							var userActivity = watchCtx.userActivities[msg.userId] || {};
							userActivity.offset = offset;
							watchCtx.userActivities[msg.userId] = userActivity;
						}
						clUserInfoSvc.request(msg.userId);
					}
					watchCtx.sentMsg = undefined;
				}
				watchCtx.fileDao.contentDao.properties = clDiffUtils.mergeObjects(watchCtx.properties, watchCtx.fileDao.contentDao.properties, serverProperties);
				watchCtx.fileDao.contentDao.discussions = clDiffUtils.mergeObjects(watchCtx.discussions, watchCtx.fileDao.contentDao.discussions, serverDiscussions);
				watchCtx.fileDao.contentDao.comments = clDiffUtils.mergeObjects(watchCtx.comments, watchCtx.fileDao.contentDao.comments, serverComments);
				watchCtx.fileDao.contentDao.conflicts = clDiffUtils.mergeObjects(watchCtx.conflicts, watchCtx.fileDao.contentDao.conflicts, serverConflicts);
				watchCtx.text = serverText;
				watchCtx.properties = serverProperties;
				watchCtx.discussions = serverDiscussions;
				watchCtx.comments = serverComments;
				watchCtx.conflicts = serverConflicts;
				clContentRevSvc.setContent(watchCtx.fileDao.id, watchCtx);
				apply && $rootScope.$evalAsync();
			});

			clSetInterval(function() {
				// Check that window has focus and socket is online
				if (!clUserActivity.checkActivity() || !clSocketSvc.isOnline()) {
					return;
				}
				clFileSvc.localFiles.cl_each(function(fileDao) {
					// Check that content is not being edited
					if (fileDao.isReadOnly || clSyncDataSvc.isFilePendingCreation(fileDao) || (watchCtx && fileDao === watchCtx.fileDao)) {
						return;
					}
					if (fileDao.userId && (fileDao.sharing !== 'rw' || !clUserSvc.isUserPremium())) {
						return;
					}
					var currentDate = Date.now();
					var fromRev = clContentRevSvc.getRev(fileDao.id);
					fromRev && fileDao.loadExecUnload(function() {
						// Check that content is not being modified in another instance
						if (currentDate - fileDao.contentDao.lastModified < backgroundUpdateContentEvery) {
							return;
						}
						if (!clContentRevSvc.isServerContent(fileDao.id, fileDao.contentDao)) {
							clSocketSvc.sendMsg({
								type: 'updateContent',
								id: fileDao.id,
								fromRev: fromRev,
								text: fileDao.contentDao.text,
								properties: fileDao.contentDao.properties,
								discussions: fileDao.contentDao.discussions,
								comments: fileDao.contentDao.comments,
								conflicts: fileDao.contentDao.conflicts,
							});
						}
					});
				});
			}, backgroundUpdateContentEvery);

			clSocketSvc.addMsgHandler('updatedContent', function(msg) {
				var fileDao = clFileSvc.fileMap[msg.id];
				// Check that file still exists and content is still local
				if (!fileDao || !fileDao.contentDao.isLocal) {
					return;
				}
				// Check that content is not being edited
				if (watchCtx && watchCtx.fileDao.id === fileDao.id) {
					return;
				}
				var currentDate = Date.now();
				fileDao.loadExecUnload(function() {
					// Check that content is not being modified in another instance
					if (currentDate - fileDao.contentDao.lastModified < backgroundUpdateContentEvery) {
						return;
					}
					// Update content
					fileDao.contentDao.text = msg.text;
					fileDao.contentDao.properties = msg.properties;
					fileDao.contentDao.discussions = msg.discussions;
					fileDao.contentDao.comments = msg.comments;
					fileDao.contentDao.conflicts = msg.conflicts;
					fileDao.writeContent();
					clContentRevSvc.setContent(fileDao.id, msg);
				});
			});

			$rootScope.$watch('currentFileDao', function(currentFileDao) {
				if (currentFileDao) {
					currentFileDao.loadPending = true;
				}
				if (clSocketSvc.isOnline()) {
					clSyncDataSvc.read(clSocketSvc.ctx);
					stopWatchFile();
					startWatchFile(currentFileDao);
				} else if (!clSocketSvc.hasToken) {
					getPublicFile(currentFileDao);
				}
			});

			clSetInterval(function() {
				if (!clUserActivity.checkActivity()) {
					return;
				}
				var currentFileDao = $rootScope.currentFileDao;
				if (clSocketSvc.isOnline()) {
					if (clSyncDataSvc.read(clSocketSvc.ctx)) {
						stopWatchFile();
					}
					startWatchFile(currentFileDao);
					sendContentChange();
				} else if (!clSocketSvc.hasToken) {
					getPublicFile(currentFileDao);
				}
			}, 200);

			return clContentSyncSvc;
		});
