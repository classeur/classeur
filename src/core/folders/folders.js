angular.module('classeur.core.folders', [])
	.factory('clFolderSvc', function(clUid, clLocalStorageObject) {
		var folderDaoProto = clLocalStorageObject('F');

		function FolderDao(id) {
			this.id = id;
			this.$setId(id);
			this.read();
		}

		FolderDao.prototype = folderDaoProto;

		FolderDao.prototype.read = function() {
			this.$readAttr('name', '');
			this.$readAttr('sharing', '');
			this.$readLocalUpdate();
		};

		FolderDao.prototype.write = function(updated) {
			this.$writeAttr('name', undefined, updated);
			this.$writeAttr('sharing', undefined, updated);
		};

		var clFolderSvc = clLocalStorageObject('folderSvc');

		var authorizedKeys = {
			u: true,
			name: true,
			sharing: true,
		};

		function init(cleanStorage) {
			if (!clFolderSvc.folderIds) {
				clFolderSvc.$readAttr('folderIds', '[]', JSON.parse);
			}
			clFolderSvc.folders = clFolderSvc.folderIds.map(function(id) {
				return clFolderSvc.folderMap[id] || new FolderDao(id);
			});
			clFolderSvc.folderMap = {};
			clFolderSvc.folders.forEach(function(folderDao) {
				clFolderSvc.folderMap[folderDao.id] = folderDao;
			});

			if (cleanStorage) {
				var keyPrefix = /^F\.(\w+)\.(\w+)/;
				for (var key in localStorage) {
					var match = key.match(keyPrefix);
					if (match) {
						var folderDao = clFolderSvc.folderMap[match[1]];
						if (!folderDao || !authorizedKeys.hasOwnProperty(match[2])) {
							localStorage.removeItem(key);
						}
					}
				}
			}
		}

		function checkAll() {
			// Check folder id list
			var checkFolderSvcUpdate = clFolderSvc.$checkGlobalUpdate();
			clFolderSvc.$readGlobalUpdate();
			if (checkFolderSvcUpdate && clFolderSvc.$checkAttr('folderIds', '[]')) {
				clFolderSvc.folderIds = undefined;
			} else {
				clFolderSvc.$writeAttr('folderIds', JSON.stringify);
			}

			// Check every folder
			var checkFolderUpdate = folderDaoProto.$checkGlobalUpdate();
			folderDaoProto.$readGlobalUpdate();
			clFolderSvc.folders.forEach(function(folderDao) {
				if (checkFolderUpdate && folderDao.$checkLocalUpdate()) {
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

		function createFolder() {
			var id = clUid();
			clFolderSvc.folderIds.push(id);
			init();
			return clFolderSvc.folderMap[id];
		}

		function removeFolder(folderDao) {
			var index = clFolderSvc.folders.indexOf(folderDao);
			if (index !== -1) {
				clFolderSvc.folderIds.splice(index, 1);
				init();
			}
			return index;
		}

		function updateFolders(changes) {
			changes.forEach(function(change) {
				var folderDao = clFolderSvc.folderMap[change.id];
				if (change.deleted && folderDao) {
					var index = clFolderSvc.folders.indexOf(folderDao);
					clFolderSvc.folderIds.splice(index, 1);
				} else if (!folderDao) {
					folderDao = new FolderDao(change.id);
					clFolderSvc.folderMap[change.id] = folderDao;
					clFolderSvc.folderIds.push(change.id);
				}
				folderDao.name = change.name;
				folderDao.sharing = change.sharing;
				folderDao.write(change.updated);
			});
			init();
		}

		clFolderSvc.folderDaoProto = folderDaoProto;
		clFolderSvc.init = init;
		clFolderSvc.checkAll = checkAll;
		clFolderSvc.createFolder = createFolder;
		clFolderSvc.removeFolder = removeFolder;
		clFolderSvc.updateFolders = updateFolders;
		clFolderSvc.folderMap = {};

		init(true);
		return clFolderSvc;
	});
