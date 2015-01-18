angular.module('classeur.core.files', [])
	.factory('clFileSvc', function(clUid, clLocalStorageObject, $timeout) {
		var maxLocalFiles = 5;

		function LocalFile(id) {
			this.id = id;
			this.$readAttr('updated', '0', parseInt);
			this.read();
		}

		LocalFile.prototype = clLocalStorageObject('file');

		LocalFile.prototype.read = function(loadedAttr) {
			if(!loadedAttr) {
				this.$readAttr('title', '');
				this.$readAttr('folderId', '');
			}
			else if(this.isLoaded) {
				this.$readAttr('content', '');
				this.$readAttr('state', '{}', JSON.parse);
				this.$readAttr('users', '{}', JSON.parse);
				this.$readAttr('discussions', '{}', JSON.parse);
			}
		};

		LocalFile.prototype.checkChanges = function(loadedAttr) {
			var hasChanged = false;
			if(!loadedAttr) {
				hasChanged |= this.$checkAttr('title', '');
				hasChanged |= this.$checkAttr('folderId', '');
			}
			else if(this.isLoaded) {
				hasChanged |= this.$checkAttr('updated', '0');
			}
			return hasChanged;
		};

		LocalFile.prototype.write = function() {
			this.$writeAttr('title');
			this.$writeAttr('folderId');
			if(this.isLoaded) {
				var isUpdated = false;
				isUpdated |= this.$writeAttr('content');
				isUpdated |= this.$writeAttr('users', JSON.stringify);
				isUpdated |= this.$writeAttr('discussions', JSON.stringify);
				this.$writeAttr('state', JSON.stringify);
				if(isUpdated) {
					this.updated = Date.now();
					this.$writeAttr('updated');
				}
			}
		};

		LocalFile.prototype.load = function(cb) {
			if(this.isLoaded) {
				return cb();
			}
			$timeout((function() {
				this.isLoaded = true;
				this.read(true);
				cb();
			}).bind(this));
		};

		LocalFile.prototype.unload = function() {
			this.$freeAttr('content');
			this.$freeAttr('state');
			this.$freeAttr('users');
			this.$freeAttr('discussions');
			this.isLoaded = false;
		};

		function ReadOnlyFile(title, content) {
			this.title = title;
			this.content = content;
			this.state = {};
			this.users = {};
			this.discussions = {};
			this.isReadOnly = true;
		}

		function init() {
			if(!clFileSvc.localFileIds) {
				clFileSvc.$readAttr('localFileIds', '[]', JSON.parse);
			}
			clFileSvc.localFiles = clFileSvc.localFileIds.map(function(id) {
				return clFileSvc.localFileMap[id] || new LocalFile(id);
			});
			clFileSvc.localFileMap = {};
			clFileSvc.localFiles.forEach(function(fileDao) {
				clFileSvc.localFileMap[fileDao.id] = fileDao;
			});
			var keyPrefix = /^cl\.file\.(\w+)\./;
			for(var key in localStorage) {
				var match = key.match(keyPrefix);
				if(match && !clFileSvc.localFileMap[match[1]]) {
					localStorage.removeItem(key);
				}
			}
		}

		function checkLocalFileIds(isStorageModified) {
			if(isStorageModified && clFileSvc.$checkAttr('localFileIds', '[]')) {
				delete clFileSvc.localFileIds;
				return true;
			}
			clFileSvc.$writeAttr('localFileIds', JSON.stringify);
		}

		function createLocalFile() {
			clFileSvc.localFileIds.sort(function(id1, id2) {
				return clFileSvc.localFileMap[id1].updated - clFileSvc.localFileMap[id2].updated;
			});
			var id = clUid();
			clFileSvc.localFileIds.unshift(id);
			clFileSvc.localFileIds.splice(maxLocalFiles);
			init();
			return clFileSvc.localFileMap[id];
		}

		function removeLocalFiles(fileDaoList) {
			var fileIds = {};
			fileDaoList.forEach(function(fileDao) {
				fileIds[fileDao.id] = 1;
			});
			clFileSvc.localFileIds = clFileSvc.localFileIds.filter(function(fileId) {
				return !fileIds.hasOwnProperty(fileId);
			});
			init();
		}

		function createReadOnlyFile(title, content) {
			return new ReadOnlyFile(title, content);
		}

		var clFileSvc = Object.create(clLocalStorageObject());
		clFileSvc.init = init;
		clFileSvc.checkLocalFileIds = checkLocalFileIds;
		clFileSvc.createLocalFile = createLocalFile;
		clFileSvc.removeLocalFiles = removeLocalFiles;
		clFileSvc.createReadOnlyFile = createReadOnlyFile;
		clFileSvc.localFileMap = {};

		return clFileSvc;
	});
