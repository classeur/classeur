angular.module('classeur.core.files', [])
	.factory('clFileSvc', function(clUid, clLocalStorageObject, $timeout) {
		var maxLocalFiles = 5;

		function FileDao(id) {
			this.id = id;
			this.$setPrefix('f', id);
			this.contentDao = clLocalStorageObject('c', id);
			this.read();
			this.readContent();
		}

		FileDao.prototype = clLocalStorageObject();

		FileDao.prototype.read = function() {
			this.$readAttr('name', '');
			this.$readAttr('folderId', '');
			this.$readLocalUpdate();
		};

		FileDao.prototype.write = function() {
			this.$writeAttr('name');
			this.$writeAttr('folderId');
		};

		FileDao.prototype.readContent = function() {
			this.contentDao.$readAttr('isLocal', '');
			this.contentDao.$readAttr('lastChange', '0', parseInt);
			if (this.isLoaded) {
				this.contentDao.$readAttr('content', '');
				this.contentDao.$readAttr('users', '{}', JSON.parse);
				this.contentDao.$readAttr('discussions', '{}', JSON.parse);
				this.contentDao.$readAttr('state', '{}', JSON.parse);
			}
			this.contentDao.$readLocalUpdate();
		};

		FileDao.prototype.writeContent = function(updateLastChange) {
			this.contentDao.$writeAttr('isLocal');
			if (this.isLoaded) {
				updateLastChange |= this.contentDao.$writeAttr('content');
				updateLastChange |= this.contentDao.$writeAttr('users', JSON.stringify);
				updateLastChange |= this.contentDao.$writeAttr('discussions', JSON.stringify);
				this.contentDao.$writeAttr('state', JSON.stringify);
			}
			if (updateLastChange) {
				this.contentDao.lastChange = Date.now();
				this.contentDao.$writeAttr('lastChange');
			}
		};

		FileDao.prototype.load = function(cb) {
			if (this.isLoaded) {
				return cb();
			}
			if (this.contentDao.isLocal) {
				return $timeout((function() {
					this.isLoaded = true;
					this.readContent();
					cb();
				}).bind(this));
			}
			// TODO get content from server and set the file as local
			alert('Not implemented');
		};

		FileDao.prototype.unload = function() {
			this.contentDao.$freeAttr('content');
			this.contentDao.$freeAttr('users');
			this.contentDao.$freeAttr('discussions');
			this.contentDao.$freeAttr('state');
			this.isLoaded = false;
		};

		function ReadOnlyFile(name, content) {
			this.name = name;
			this.contentDao = {
				content: content,
				state: {},
				users: {},
				discussions: {}
			};
			this.isLoaded = true;
			this.isReadOnly = true;
			this.unload = function() {};
		}

		var clFileSvc = clLocalStorageObject('fileSvc');

		var fileAuthorizedKeys = {
			u: true,
			name: true,
			folderId: true,
		};

		var contentAuthorizedKeys = {
			u: true,
			lastChange: true,
			isLocal: true,
			content: false,
			users: false,
			discussions: false,
			state: false,
		};

		function init(cleanStorage) {
			if (!clFileSvc.fileIds) {
				clFileSvc.$readAttr('fileIds', '[]', JSON.parse);
			}
			clFileSvc.files = clFileSvc.fileIds.map(function(id) {
				return clFileSvc.fileMap[id] || new FileDao(id);
			});
			clFileSvc.fileMap = {};
			clFileSvc.localFiles = [];
			clFileSvc.files.forEach(function(fileDao) {
				clFileSvc.fileMap[fileDao.id] = fileDao;
				fileDao.contentDao.isLocal && clFileSvc.localFiles.push(fileDao);
			});
			clFileSvc.localFiles.sort(function(fileDao1, fileDao2) {
				return fileDao2.contentDao.lastChange - fileDao1.contentDao.lastChange;
			}).splice(maxLocalFiles).forEach(function(fileDao) {
				fileDao.unload();
				fileDao.contentDao.isLocal = '';
				fileDao.writeContent();
			});

			if (cleanStorage) {
				var fileKeyPrefix = /^f\.(\w+)\.(\w+)/;
				var contentKeyPrefix = /^c\.(\w+)\.(\w+)/;
				for (var key in localStorage) {
					var fileDao, match = key.match(fileKeyPrefix);
					if (match) {
						fileDao = clFileSvc.fileMap[match[1]];
						if (!fileDao || !fileAuthorizedKeys.hasOwnProperty(match[2])) {
							localStorage.removeItem(key);
						}
						continue;
					}
					match = key.match(contentKeyPrefix);
					if (match) {
						fileDao = clFileSvc.fileMap[match[1]];
						if (!fileDao || !contentAuthorizedKeys.hasOwnProperty(match[2]) || (!fileDao.contentDao.isLocal && !contentAuthorizedKeys[match[2]])) {
							localStorage.removeItem(key);
						}
					}
				}
			}
		}

		var fileSvcUpdateKey = clFileSvc.$globalUpdateKey;
		var lastFileSvcUpdate = localStorage[fileSvcUpdateKey];
		var fileUpdateKey = clLocalStorageObject('f').$globalUpdateKey;
		var lastFileUpdate = localStorage[fileUpdateKey];
		var contentUpdateKey = clLocalStorageObject('c').$globalUpdateKey;
		var lastContentUpdate = localStorage[contentUpdateKey];

		function checkAll() {
			// Check file id list
			var checkFileSvcUpdate = lastFileSvcUpdate !== localStorage[fileSvcUpdateKey];
			if (checkFileSvcUpdate && clFileSvc.$checkAttr('fileIds', '[]')) {
				delete clFileSvc.fileIds;
			} else {
				clFileSvc.$writeAttr('fileIds', JSON.stringify);
			}

			// Check every file
			var checkFileUpdate = lastFileUpdate !== localStorage[fileUpdateKey];
			var checkContentUpdate = lastContentUpdate !== localStorage[contentUpdateKey];
			clFileSvc.files.forEach(function(fileDao) {
				if (checkFileUpdate && fileDao.$checkLocalUpdate()) {
					fileDao.read();
				} else {
					fileDao.write();
				}
				if (checkContentUpdate && fileDao.contentDao.$checkLocalUpdate()) {
					fileDao.unload();
					fileDao.readContent();
				} else {
					fileDao.writeContent();
				}
			});

			lastFileSvcUpdate = localStorage[fileSvcUpdateKey];
			lastFileUpdate = localStorage[fileUpdateKey];
			lastContentUpdate = localStorage[contentUpdateKey];

			if (checkFileSvcUpdate || checkFileUpdate || checkContentUpdate) {
				init();
				return true;
			}
		}

		function createFile() {
			var id = clUid();
			var fileDao = new FileDao(id);
			fileDao.contentDao.isLocal = '1';
			fileDao.writeContent(true);
			clFileSvc.fileMap[id] = fileDao;
			clFileSvc.fileIds.push(id);
			init();
			return clFileSvc.fileMap[id];
		}

		function removeFiles(fileDaoList) {
			var fileIds = {};
			fileDaoList.forEach(function(fileDao) {
				fileIds[fileDao.id] = 1;
			});
			clFileSvc.fileIds = clFileSvc.fileIds.filter(function(fileId) {
				return !fileIds.hasOwnProperty(fileId);
			});
			init();
		}

		function createReadOnlyFile(name, content) {
			return new ReadOnlyFile(name, content);
		}

		clFileSvc.init = init;
		clFileSvc.checkAll = checkAll;
		clFileSvc.createFile = createFile;
		clFileSvc.removeFiles = removeFiles;
		clFileSvc.createReadOnlyFile = createReadOnlyFile;
		clFileSvc.fileMap = {};

		return clFileSvc;
	});
