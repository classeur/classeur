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
				return (!fileDao.userId || fileDao.sharing === 'rw') && fileDao.contentDao.isLocal && !clSyncDataSvc.files.hasOwnProperty(fileDao.id);
			}

			function updatePublicFileMetadata(fileDao, metadata) {
				fileDao.refreshed = Date.now();
				var syncData = clSyncDataSvc.files[fileDao.id] || {};
				// File permission can change without metadata update
				if (metadata.updated && ((metadata.updated !== syncData.r && metadata.updated !== syncData.s) || fileDao.sharing !== metadata.permission)) {
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
		function(clLocalStorage, clFileSvc) {
			var contentRevKeyPrefix = 'cr.';

			var fileKeyPrefix = /^cr\.(\w\w+)/;
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

			return {
				setRev: function(fileId, rev) {
					clLocalStorage.setItem(contentRevKeyPrefix + fileId, rev);
				},
				getRev: function(fileId) {
					var rev = parseInt(clLocalStorage.getItem(contentRevKeyPrefix + fileId));
					return isNaN(rev) ? undefined : rev;
				}
			};
		})
	.factory('clSyncSvc',
		function($rootScope, $location, $http, clIsNavigatorOnline, clToast, clUserSvc, clFileSvc, clFolderSvc, clClasseurSvc, clSettingSvc, clLocalSettingSvc, clSocketSvc, clUserActivity, clSetInterval, clSyncUtils, clSyncDataSvc, clContentRevSvc) {
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
						msg.user = clUserSvc.user;
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
				$http.get('/api/metadata/folders', {
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
					msg.rev && clContentRevSvc.setRev(msg.id, msg.rev);
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
				$http.get('/api/metadata/files', {
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
								!item.updated && clToast('File not accessible: ' + fileDao.name);
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
				$http.get('/api/folders/' + folderDao.id, {
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
		function($rootScope, $timeout, $http, clSetInterval, clSocketSvc, clUserSvc, clUserActivity, clSyncDataSvc, clFileSvc, clToast, clSyncUtils, clEditorSvc, clContentRevSvc, clUserInfoSvc, clUid, clIsNavigatorOnline, clEditorLayoutSvc) {
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
				clToast(error || 'File not accessible: ' + fileDao.name);
			}

			function reduceObject(obj) {
				return obj.cl_reduce(function(result, value, key) {
					return (result[key] = value[1]), result;
				}, {});
			}

			function getServerContent(content, contentChanges) {
				var chars = content.text.cl_reduce(function(chars, item) {
					return chars.concat(item[1].split('').cl_map(function(c) {
						return [item[0], c];
					}));
				}, []);

				var properties = reduceObject(content.properties);
				var discussions = reduceObject(content.discussions);
				var comments = reduceObject(content.comments);
				var conflicts = reduceObject(content.conflicts);
				var userId;
				chars = contentChanges.cl_reduce(function(chars, contentChange) {
					userId = contentChange.userId || userId;
					properties = clSyncUtils.applyObjectPatches(properties, contentChange.properties || []);
					discussions = clSyncUtils.applyObjectPatches(discussions, contentChange.discussions || []);
					comments = clSyncUtils.applyObjectPatches(comments, contentChange.comments || []);
					conflicts = clSyncUtils.applyObjectPatches(conflicts, contentChange.conflicts || []);
					return clSyncUtils.applyCharPatches(chars, contentChange.text || [], userId);
				}, chars);
				var text = chars.cl_map(function(item) {
					return item[1];
				}).join('');
				return {
					chars: chars,
					text: text,
					properties: properties,
					discussions: discussions,
					comments: comments,
					conflicts: conflicts,
					rev: content.rev + contentChanges.length
				};
			}

			function mergeObjects(oldObject, localObject, serverObject) {
				var valueHash = Object.create(null),
					valueArray = [];
				var localObjectHash = clSyncUtils.hashObject(localObject, valueHash, valueArray);
				var oldObjectHash = clSyncUtils.hashObject(oldObject, valueHash, valueArray);
				var serverObjectHash = clSyncUtils.hashObject(serverObject, valueHash, valueArray);
				var isServerObjectChanges = oldObjectHash !== serverObjectHash;
				var isLocalObjectChanges = oldObjectHash !== localObjectHash;
				var isObjectSynchronized = serverObjectHash === localObjectHash;
				if (!isObjectSynchronized && isServerObjectChanges) {
					return clSyncUtils.unhashObject(
						isLocalObjectChanges ? clSyncUtils.quickPatch(oldObjectHash, localObjectHash, serverObjectHash) : serverObjectHash,
						valueArray
					);
				}
				return localObject;
			}

			function applyServerContent(fileDao, oldContent, serverContent) {
				var oldText = oldContent.text.cl_map(function(item) {
					return item[1];
				}).join('');
				var serverText = serverContent.text;
				var localText = clEditorSvc.cledit.getContent();
				var isServerTextChanges = oldText !== serverText;
				var isLocalTextChanges = oldText !== localText;
				var isTextSynchronized = serverText === localText;
				if (!isTextSynchronized && isServerTextChanges && isLocalTextChanges) {
					var textWithConflicts = clSyncUtils.patchText(oldText, serverText, localText);
					clEditorSvc.setContent(textWithConflicts[0], true);
					if (textWithConflicts[1].length) {
						textWithConflicts[1].cl_each(function(conflict) {
							fileDao.contentDao.conflicts[clUid()] = conflict;
						});
						clEditorLayoutSvc.currentControl = 'conflictAlert';
					}
				} else if (!isTextSynchronized && isServerTextChanges) {
					clEditorSvc.setContent(serverText, true);
				}

				fileDao.contentDao.properties = mergeObjects(oldContent.properties, fileDao.contentDao.properties, serverContent.properties);
				fileDao.contentDao.discussions = mergeObjects(oldContent.discussions, fileDao.contentDao.discussions, serverContent.discussions);
				fileDao.contentDao.comments = mergeObjects(oldContent.comments, fileDao.contentDao.comments, serverContent.comments);
				fileDao.contentDao.conflicts = mergeObjects(oldContent.conflicts, fileDao.contentDao.conflicts, serverContent.conflicts);
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
					from: watchCtx.rev
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
				var serverContent = getServerContent(msg.content, msg.contentChanges);
				if (fileDao.state === 'loading') {
					setLoadedContent(fileDao, serverContent);
					apply = true;
				} else {
					applyServerContent(fileDao, msg.content, serverContent);
				}
				watchCtx.chars = serverContent.chars;
				watchCtx.text = serverContent.text;
				watchCtx.properties = serverContent.properties;
				watchCtx.discussions = serverContent.discussions;
				watchCtx.comments = serverContent.comments;
				watchCtx.conflicts = serverContent.conflicts;
				watchCtx.rev = serverContent.rev;
				clContentRevSvc.setRev(fileDao.id, serverContent.rev);
				// Evaluate scope synchronously to have cledit instantiated
				apply && $rootScope.$apply();
			});

			function getPublicFile(fileDao) {
				if (!fileDao || !fileDao.state || !fileDao.loadPending || !fileDao.userId || !clIsNavigatorOnline()) {
					return;
				}
				fileDao.loadPending = false;
				var fromRev = clContentRevSvc.getRev(fileDao.id);
				$http.get('/api/files/' + fileDao.id + (fromRev ? '/from/' + fromRev : ''), {
						timeout: clSyncDataSvc.loadingTimeout
					})
					.success(function(res) {
						clSyncDataSvc.updatePublicFileMetadata(fileDao, res);
						if (!fileDao.state) {
							return;
						}
						var serverContent = getServerContent(res.content, res.contentChanges || []);
						if (fileDao.state === 'loading') {
							setLoadedContent(fileDao, serverContent);
						} else {
							applyServerContent(fileDao, res.content, serverContent);
						}
						clContentRevSvc.setRev(fileDao.id, serverContent.rev);
					})
					.error(function() {
						setLoadingError(fileDao);
					});
			}

			function getObjectPatches(oldObject, newObject) {
				var objectPatches = clSyncUtils.getObjectPatches(oldObject, newObject);
				return objectPatches.length ? objectPatches : undefined;
			}

			function sendContentChange() {
				if (!watchCtx || watchCtx.text === undefined || watchCtx.sentMsg) {
					return;
				}
				if (watchCtx.fileDao.userId && (watchCtx.fileDao.sharing !== 'rw' || clUserSvc.user.roles.indexOf('premium_user') === -1)) {
					return;
				}
				var textChanges = clSyncUtils.getTextPatches(watchCtx.text, clEditorSvc.cledit.getContent());
				textChanges = textChanges.length ? textChanges : undefined;
				var propertiesPatches = getObjectPatches(watchCtx.properties, watchCtx.fileDao.contentDao.properties);
				var discussionsPatches = getObjectPatches(watchCtx.discussions, watchCtx.fileDao.contentDao.discussions);
				var commentsPatches = getObjectPatches(watchCtx.comments, watchCtx.fileDao.contentDao.comments);
				var conflictsPatches = getObjectPatches(watchCtx.conflicts, watchCtx.fileDao.contentDao.conflicts);
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
					watchCtx.chars = clSyncUtils.applyCharPatches(watchCtx.chars, msg.text || [], msg.userId || clSyncDataSvc.userId);
					serverText = watchCtx.chars.cl_map(function(item) {
						return item[1];
					}).join('');
					apply |= !!(msg.properties || msg.discussions || msg.comments || msg.conflicts);
					serverProperties = clSyncUtils.applyObjectPatches(serverProperties, msg.properties || []);
					serverDiscussions = clSyncUtils.applyObjectPatches(serverDiscussions, msg.discussions || []);
					serverComments = clSyncUtils.applyObjectPatches(serverComments, msg.comments || []);
					serverConflicts = clSyncUtils.applyObjectPatches(serverConflicts, msg.conflicts || []);
					if (msg !== watchCtx.sentMsg) {
						var isServerTextChanges = oldText !== serverText;
						var isLocalTextChanges = oldText !== localText;
						var isTextSynchronized = serverText === localText;
						if (!isTextSynchronized && isServerTextChanges) {
							if (isLocalTextChanges) {
								localText = clSyncUtils.quickPatch(oldText, serverText, localText);
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
				watchCtx.fileDao.contentDao.properties = mergeObjects(watchCtx.properties, watchCtx.fileDao.contentDao.properties, serverProperties);
				watchCtx.fileDao.contentDao.discussions = mergeObjects(watchCtx.discussions, watchCtx.fileDao.contentDao.discussions, serverDiscussions);
				watchCtx.fileDao.contentDao.comments = mergeObjects(watchCtx.comments, watchCtx.fileDao.contentDao.comments, serverComments);
				watchCtx.fileDao.contentDao.conflicts = mergeObjects(watchCtx.conflicts, watchCtx.fileDao.contentDao.conflicts, serverConflicts);
				watchCtx.text = serverText;
				watchCtx.properties = serverProperties;
				watchCtx.discussions = serverDiscussions;
				watchCtx.comments = serverComments;
				watchCtx.conflicts = serverConflicts;
				clContentRevSvc.setRev(watchCtx.fileDao.id, watchCtx.rev);
				apply && $rootScope.$evalAsync();
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
		})
	.factory('clSyncUtils',
		function($window, clOffsetUtils) {
			var diffMatchPatch = new $window.diff_match_patch();
			var diffMatchPatchStrict = new $window.diff_match_patch();
			diffMatchPatchStrict.Match_Threshold = 0;
			diffMatchPatchStrict.Patch_DeleteThreshold = 0;
			var DIFF_DELETE = -1;
			var DIFF_INSERT = 1;
			var DIFF_EQUAL = 0;

			function getTextPatches(oldText, newText) {
				var diffs = diffMatchPatch.diff_main(oldText, newText);
				diffMatchPatch.diff_cleanupEfficiency(diffs);
				var patches = [];
				var startOffset = 0;
				diffs.cl_each(function(change) {
					var changeType = change[0];
					var changeText = change[1];
					switch (changeType) {
						case DIFF_EQUAL:
							startOffset += changeText.length;
							break;
						case DIFF_DELETE:
							changeText && patches.push({
								o: startOffset,
								d: changeText
							});
							break;
						case DIFF_INSERT:
							changeText && patches.push({
								o: startOffset,
								a: changeText
							});
							startOffset += changeText.length;
							break;
					}
				});
				return patches;
			}

			function getObjectPatches(oldObject, newObjects) {
				var valueHash = Object.create(null),
					valueArray = [];
				oldObject = hashObject(oldObject, valueHash, valueArray);
				newObjects = hashObject(newObjects, valueHash, valueArray);
				var diffs = diffMatchPatch.diff_main(oldObject, newObjects);
				var patches = [];
				diffs.cl_each(function(change) {
					var changeType = change[0];
					var changeHash = change[1];
					if (changeType === DIFF_EQUAL) {
						return;
					}
					changeHash.split('').cl_each(function(objHash) {
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

			function applyCharPatches(chars, patches, userId) {
				return patches.cl_reduce(function(chars, patch) {
					if (patch.a) {
						return chars.slice(0, patch.o).concat(patch.a.split('').cl_map(function(c) {
							return [userId, c];
						})).concat(chars.slice(patch.o));
					} else if (patch.d) {
						return chars.slice(0, patch.o).concat(chars.slice(patch.o + patch.d.length));
					} else {
						return chars;
					}
				}, chars);
			}

			function applyObjectPatches(obj, patches) {
				var result = ({}).cl_extend(obj);
				patches.cl_each(function(patch) {
					if (patch.a) {
						result[patch.k] = patch.a;
					} else if (patch.d) {
						delete result[patch.k];
					}
				});
				return result;
			}

			function quickPatch(oldStr, newStr, destStr, strict) {
				var dmp = strict ? diffMatchPatchStrict : diffMatchPatch;
				var diffs = dmp.diff_main(oldStr, newStr);
				var patches = dmp.patch_make(oldStr, diffs);
				var patchResult = dmp.patch_apply(patches, destStr);
				return patchResult[0];
			}

			function patchText(oldStr, newStr, destStr) {
				var valueHash = Object.create(null),
					valueArray = [];
				var oldHash = hashArray(oldStr.split('\n'), valueHash, valueArray);
				var newHash = hashArray(newStr.split('\n'), valueHash, valueArray);
				var destHash = hashArray(destStr.split('\n'), valueHash, valueArray);
				var diffs = diffMatchPatchStrict.diff_main(oldHash, newHash);
				var patches = diffMatchPatchStrict.patch_make(oldHash, diffs);
				var patchResult = diffMatchPatchStrict.patch_apply(patches, destHash);
				if (!patchResult[1].cl_some(function(changeApplied) {
						return !changeApplied;
					})) {
					return [unhashArray(patchResult[0], valueArray).join('\n'), []];
				}
				var conflicts = [],
					conflict = {},
					lastType,
					resultHash = '';
				diffs = diffMatchPatchStrict.diff_main(patchResult[0], newHash);
				diffs.cl_each(function(diff) {
					var diffType = diff[0];
					var diffText = diff[1];
					resultHash += diffText;
					if (diffType !== lastType) {
						if (conflict.offset3) {
							conflicts.push(conflict);
							conflict = {};
						}
						if (conflict.offset2) {
							if (diffType === DIFF_EQUAL) {
								conflict = {};
							} else {
								conflict.offset3 = resultHash.length;
							}
						} else if (diffType !== DIFF_EQUAL) {
							conflict.offset1 = resultHash.length - diffText.length;
							conflict.offset2 = resultHash.length;
						}
					}
					lastType = diffType;
				});
				conflict.offset3 && conflicts.push(conflict);
				var resultLines = unhashArray(resultHash, valueArray);
				var resultStr = resultLines.join('\n');
				var lastOffset = 0;
				var resultLineOffsets = resultLines.cl_map(function(resultLine) {
					var result = lastOffset;
					lastOffset += resultLine.length + 1;
					return result;
				});
				return [resultStr, conflicts.cl_map(function(conflict) {
					return {
						patches: [
							clOffsetUtils.offsetToPatch(resultStr, resultLineOffsets[conflict.offset1]),
							clOffsetUtils.offsetToPatch(resultStr, resultLineOffsets[conflict.offset2]),
							clOffsetUtils.offsetToPatch(resultStr, resultLineOffsets[conflict.offset3]),
						]
					};
				})];
			}

			function hashArray(arr, valueHash, valueArray) {
				var hash = [];
				arr.cl_each(function(obj) {
					var serializedObj = JSON.stringify(obj, function(key, value) {
						return Object.prototype.toString.call(value) === '[object Object]' ?
							Object.keys(value).sort().cl_reduce(function(sorted, key) {
								return sorted[key] = value[key], sorted;
							}, {}) : value;
					});
					var objHash = valueHash[serializedObj];
					if (objHash === undefined) {
						objHash = valueArray.length;
						valueArray.push(obj);
						valueHash[serializedObj] = objHash;
					}
					hash.push(objHash);
				});
				return String.fromCharCode.apply(null, hash);
			}

			function unhashArray(hash, valueArray) {
				return hash.split('').cl_map(function(objHash) {
					return valueArray[objHash.charCodeAt(0)];
				});
			}

			function hashObject(obj, valueHash, valueArray) {
				return hashArray(Object.keys(obj || {}).sort().cl_map(function(key) {
					return [key, obj[key]];
				}), valueHash, valueArray);
			}

			function unhashObject(hash, valueArray) {
				var result = {};
				unhashArray(hash, valueArray).cl_each(function(value) {
					result[value[0]] = value[1];
				});
				return result;
			}

			return {
				getTextPatches: getTextPatches,
				getObjectPatches: getObjectPatches,
				applyCharPatches: applyCharPatches,
				applyObjectPatches: applyObjectPatches,
				quickPatch: quickPatch,
				patchText: patchText,
				hashArray: hashArray,
				unhashArray: unhashArray,
				hashObject: hashObject,
				unhashObject: unhashObject,
			};
		});
