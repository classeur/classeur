angular.module('classeur.core.folders', [])
	.factory('clFolderSvc', function(clUid, clLocalStorageObject) {

		function FolderDao(id) {
			this.id = id;
			this.$setPrefix('F', id);
			this.read();
		}

		FolderDao.prototype = clLocalStorageObject();

		FolderDao.prototype.read = function() {
			this.$readAttr('name', '');
			this.$readLocalUpdate();
		};

		FolderDao.prototype.write = function() {
			this.$writeAttr('name');
		};

		var clFolderSvc = Object.create(clLocalStorageObject('folderSvc'));

		var authorizedKeys = {
			u: false,
			name: false,
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
					if(match) {
						var folderDao = clFolderSvc.folderMap[match[1]];
						if(!folderDao || !authorizedKeys.hasOwnProperty(match[2])) {
							localStorage.removeItem(key);
						}
					}
				}
			}
		}

		var folderSvcUpdateKey = clFolderSvc.$globalUpdateKey;
		var lastFolderSvcUpdate = localStorage[folderSvcUpdateKey];
		var folderUpdateKey = clLocalStorageObject('F').$globalUpdateKey;
		var lastFolderUpdate = localStorage[folderUpdateKey];

		function checkAll() {
			// Check folder id list
			var checkFolderSvcUpdate = lastFolderSvcUpdate !== localStorage[folderSvcUpdateKey];
			if (checkFolderSvcUpdate && clFolderSvc.$checkAttr('folderIds', '[]')) {
				delete clFolderSvc.folderIds;
			} else {
				clFolderSvc.$writeAttr('folderIds', JSON.stringify);
			}

			// Check every folder
			var checkFolderUpdate = lastFolderUpdate !== localStorage[folderUpdateKey];
			clFolderSvc.folders.forEach(function(folderDao) {
				if (checkFolderUpdate && folderDao.$checkLocalUpdate()) {
					folderDao.read();
				} else {
					folderDao.write();
				}
			});

			lastFolderSvcUpdate = localStorage[folderSvcUpdateKey];
			lastFolderUpdate = localStorage[folderUpdateKey];

			if(checkFolderSvcUpdate || checkFolderUpdate) {
				init();
				return true;
			}
		}

		function createFolder(name) {
			var id = clUid();
			clFolderSvc.folderIds.push(id);
			init();
			var folderDao = clFolderSvc.folderMap[id];
			folderDao.name = name;
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

		clFolderSvc.init = init;
		clFolderSvc.checkAll = checkAll;
		clFolderSvc.createFolder = createFolder;
		clFolderSvc.removeFolder = removeFolder;
		clFolderSvc.folderMap = {};

		return clFolderSvc;
	});
