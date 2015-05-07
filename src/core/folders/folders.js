angular.module('classeur.core.folders', [])
	.factory('clFolderSvc', function(clLocalStorage, clUid, clLocalStorageObject) {
		var folderDaoProto = clLocalStorageObject('F', {
			name: {},
			sharing: {},
			isPublic: {},
		}, true);

		function FolderDao(id) {
			this.id = id;
			this.$setId(id);
			this.read();
		}

		FolderDao.prototype = folderDaoProto;

		FolderDao.prototype.read = function() {
			this.$read();
			this.$readUpdate();
		};

		FolderDao.prototype.write = function(updated) {
			this.$write();
			updated && this.$writeUpdate(updated);
		};

		var clFolderSvc = clLocalStorageObject('folderSvc', {
			folderIds: {
				default: '[]',
				parser: JSON.parse,
				serializer: JSON.stringify,
			}
		});

		var authorizedKeys = {
			u: true,
			isPublic: true,
			name: true,
			sharing: true,
		};

		function init(cleanStorage) {
			if (!clFolderSvc.folderIds) {
				clFolderSvc.$read();
			}
			clFolderSvc.folders = clFolderSvc.folderIds.map(function(id) {
				return clFolderSvc.folderMap[id] || new FolderDao(id);
			});
			clFolderSvc.folderMap = clFolderSvc.folders.reduce(function(folderMap, folderDao) {
				return (folderMap[folderDao.id] = folderDao, folderMap);
			}, {});

			if (cleanStorage) {
				var keyPrefix = /^F\.(\w+)\.(\w+)/;
				Object.keys(clLocalStorage).forEach(function(key) {
					var match = key.match(keyPrefix);
					if (match) {
						var folderDao = clFolderSvc.folderMap[match[1]];
						if (!folderDao || !authorizedKeys.hasOwnProperty(match[2])) {
							clLocalStorage.removeItem(key);
						}
					}
				});
			}
		}

		function checkAll() {
			// Check folder id list
			var checkFolderSvcUpdate = clFolderSvc.$checkUpdate();
			clFolderSvc.$readUpdate();
			if (checkFolderSvcUpdate && clFolderSvc.$check()) {
				clFolderSvc.folderIds = undefined;
			} else {
				clFolderSvc.$write();
			}

			// Check every folder
			var checkFolderUpdate = folderDaoProto.$checkGlobalUpdate();
			folderDaoProto.$readGlobalUpdate();
			clFolderSvc.folders.forEach(function(folderDao) {
				if (checkFolderUpdate && folderDao.$checkUpdate()) {
					folderDao.read();
				} else {
					folderDao.write();
				}
			});

			if (checkFolderSvcUpdate || checkFolderUpdate) {
				init();
				return true;
			}
		}

		function createFolder(id) {
			id = id || clUid();
			clFolderSvc.folderIds.push(id);
			init();
			return clFolderSvc.folderMap[id];
		}

		function createPublicFolder(id) {
			var folderDao = createFolder(id);
			folderDao.isPublic = '1';
			return folderDao;
		}

		function removeFolder(folderDao) {
			var index = clFolderSvc.folders.indexOf(folderDao);
			if (index !== -1) {
				clFolderSvc.folderIds.splice(index, 1);
				init();
			}
			return index;
		}

		function removeFolders(folderDaoList) {
			if (!folderDaoList.length) {
				return;
			}
			var folderIds = {};
			folderDaoList.forEach(function(folderDao) {
				folderIds[folderDao.id] = 1;
			});
			clFolderSvc.folderIds = clFolderSvc.folderIds.filter(function(folderId) {
				return !folderIds.hasOwnProperty(folderId);
			});
			init();
		}

		function updateFolders(changes) {
			changes.forEach(function(change) {
				var folderDao = clFolderSvc.folderMap[change.id];
				if (change.deleted && folderDao) {
					var index = clFolderSvc.folders.indexOf(folderDao);
					clFolderSvc.folderIds.splice(index, 1);
				} else if (!change.deleted && !folderDao) {
					folderDao = new FolderDao(change.id);
					clFolderSvc.folderMap[change.id] = folderDao;
					clFolderSvc.folderIds.push(change.id);
				}
				folderDao.name = change.name || '';
				folderDao.sharing = change.sharing || '';
				folderDao.write(change.updated);
			});
			init();
		}

		clFolderSvc.folderDaoProto = folderDaoProto;
		clFolderSvc.init = init;
		clFolderSvc.checkAll = checkAll;
		clFolderSvc.createFolder = createFolder;
		clFolderSvc.createPublicFolder = createPublicFolder;
		clFolderSvc.removeFolder = removeFolder;
		clFolderSvc.removeFolders = removeFolders;
		clFolderSvc.updateFolders = updateFolders;
		clFolderSvc.folderMap = {};

		init(true);
		return clFolderSvc;
	});
