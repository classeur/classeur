angular.module('classeur.core.folders', [])
	.factory('clFolderSvc', function(clUid, clLocalStorageObject) {

		function Folder(id) {
			this.id = id;
			this.read();
		}

		Folder.prototype = clLocalStorageObject('folder');

		Folder.prototype.read = function() {
			this.$readAttr('name', '');
		};

		Folder.prototype.checkChanges = function() {
			return this.$checkAttr('name', '');
		};

		Folder.prototype.write = function() {
			this.$writeAttr('name');
		};

		function init() {
			if(!clFolderSvc.folderIds) {
				clFolderSvc.$readAttr('folderIds', '[]', JSON.parse);
			}
			clFolderSvc.folders = clFolderSvc.folderIds.map(function(id) {
				return clFolderSvc.folderMap[id] || new Folder(id);
			});
			clFolderSvc.folderMap = {};
			clFolderSvc.folders.forEach(function(folderDao) {
				clFolderSvc.folderMap[folderDao.id] = folderDao;
			});
			var keyPrefix = /^cl\.folder\.(\w+)\./;
			for(var key in localStorage) {
				var match = key.match(keyPrefix);
				if(match && !clFolderSvc.folderMap[match[1]]) {
					localStorage.removeItem(key);
				}
			}
		}

		function checkFolderIds(isStorageModified) {
			if(isStorageModified && clFolderSvc.$checkAttr('folderIds', '[]')) {
				delete clFolderSvc.folderIds;
				return true;
			}
			clFolderSvc.$writeAttr('folderIds', JSON.stringify);
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
			if(index !== -1) {
				clFolderSvc.folderIds.splice(index, 1);
				init();
			}
			return index;
		}

		var clFolderSvc = Object.create(clLocalStorageObject());
		clFolderSvc.init = init;
		clFolderSvc.checkFolderIds = checkFolderIds;
		clFolderSvc.createFolder = createFolder;
		clFolderSvc.removeFolder = removeFolder;
		clFolderSvc.folderMap = {};

		return clFolderSvc;
	});
