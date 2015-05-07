angular.module('classeur.core.files', [])
	.factory('clFileSvc', function($window, $timeout, clLocalStorage, clUid, clLocalStorageObject, clSocketSvc) {
		var maxLocalFiles = 3;
		var fileDaoProto = clLocalStorageObject('f', {
			name: {},
			folderId: {},
			sharing: {},
			isPublic: {},
		}, true);
		var contentDaoProto = clLocalStorageObject('c', {
			isLocal: {},
			lastChange: {
				default: '0',
				parser: parseInt
			},
			txt: {},
			properties: {
				default: '{}',
				parser: JSON.parse,
				serializer: JSON.stringify,
			},
			discussions: {
				default: '{}',
				parser: JSON.parse,
				serializer: JSON.stringify,
			},
			state: {
				default: '{}',
				parser: JSON.parse,
				serializer: JSON.stringify,
			}
		}, true);

		function FileDao(id) {
			this.id = id;
			this.$setId(id);
			this.contentDao = Object.create(contentDaoProto);
			this.contentDao.$setId(id);
			this.read();
			this.readContent();
		}

		FileDao.prototype = fileDaoProto;

		FileDao.prototype.read = function() {
			this.$read();
			this.$readUpdate();
		};

		FileDao.prototype.write = function(updated) {
			this.$write();
			updated && this.$writeUpdate(updated);
		};

		FileDao.prototype.readContent = function() {
			this.contentDao.$read.isLocal();
			this.contentDao.$read.lastChange();
			if (this.state === 'loaded') {
				this.contentDao.$read.txt();
				this.contentDao.$read.properties();
				this.contentDao.$read.discussions();
				this.contentDao.$read.state();
			}
			this.contentDao.$readUpdate();
		};

		FileDao.prototype.freeContent = function() {
			this.contentDao.$free.txt();
			this.contentDao.$free.properties();
			this.contentDao.$free.discussions();
			this.contentDao.$free.state();
		};

		FileDao.prototype.writeContent = function(updateLastChange) {
			this.contentDao.$write.isLocal();
			if (this.state === 'loaded') {
				updateLastChange |= this.contentDao.$write.txt();
				updateLastChange |= this.contentDao.$write.properties();
				updateLastChange |= this.contentDao.$write.discussions();
				this.contentDao.$write.state();
			}
			if (!this.contentDao.isLocal) {
				this.contentDao.lastChange = 0;
				this.contentDao.$write.lastChange();
			} else if (updateLastChange) {
				this.contentDao.lastChange = Date.now();
				this.contentDao.$write.lastChange();
			}
		};

		FileDao.prototype.load = function() {
			if (this.state) {
				return;
			}
			if (this.contentDao.isLocal) {
				this.state = 'loading';
				$timeout((function() {
					if (this.state === 'loading') {
						this.state = 'loaded';
						this.readContent();
					}
				}).bind(this));
			} else if (clSocketSvc.isReady || (this.isPublic && $window.navigator.onLine !== false)) {
				this.state = 'loading';
			}
		};

		FileDao.prototype.unload = function() {
			this.freeContent();
			this.state = undefined;
		};

		FileDao.prototype.loadExecUnload = function(cb) {
			var state = this.state;
			if (state === 'loaded') {
				return cb();
			}
			this.state = 'loaded';
			this.readContent();
			cb();
			this.freeContent();
			this.state = state;
		};

		function ReadOnlyFile(name, content) {
			this.name = name;
			this.contentDao = {
				txt: content,
				state: {},
				properties: {},
				users: {},
				discussions: {}
			};
			this.isReadOnly = true;
			this.state = 'loaded';
			this.unload = function() {};
		}

		var clFileSvc = clLocalStorageObject('fileSvc', {
			fileIds: {
				default: '[]',
				parser: JSON.parse,
				serializer: JSON.stringify,
			}
		});

		var fileAuthorizedKeys = {
			u: true,
			isPublic: true,
			name: true,
			sharing: true,
			folderId: true,
		};

		var contentAuthorizedKeys = {
			u: true,
			lastChange: true,
			isLocal: true,
			txt: true,
			properties: true,
			users: true,
			discussions: true,
			state: true,
		};

		var isInited;

		function init() {
			if (!clFileSvc.fileIds) {
				clFileSvc.$read();
				clFileSvc.fileMap = {};
				clFileSvc.fileIds = clFileSvc.fileIds.filter(function(id) {
					if (!clFileSvc.fileMap.hasOwnProperty(id)) {
						var fileDao = new FileDao(id);
						if (!fileDao.isPublic || fileDao.contentDao.isLocal) {
							clFileSvc.fileMap[id] = fileDao;
							return true;
						}
					}
				});
				(clFileSvc.files || []).forEach(function(fileDao) {
					!clFileSvc.fileMap.hasOwnProperty(fileDao.id) && fileDao.unload();
				});
				if (!isInited) {
					var fileKeyPrefix = /^f\.(\w+)\.(\w+)/;
					var contentKeyPrefix = /^c\.(\w+)\.(\w+)/;
					Object.keys(clLocalStorage).forEach(function(key) {
						var fileDao, match = key.match(fileKeyPrefix);
						if (match) {
							fileDao = clFileSvc.fileMap[match[1]];
							if (!fileDao || !fileAuthorizedKeys.hasOwnProperty(match[2])) {
								clLocalStorage.removeItem(key);
							}
							return;
						}
						match = key.match(contentKeyPrefix);
						if (match) {
							fileDao = clFileSvc.fileMap[match[1]];
							if (!fileDao || !contentAuthorizedKeys.hasOwnProperty(match[2]) || !fileDao.contentDao.isLocal) {
								clLocalStorage.removeItem(key);
							}
						}
					});
					isInited = true;
				}
			}
			clFileSvc.files = clFileSvc.fileIds.map(function(id) {
				return clFileSvc.fileMap[id] || new FileDao(id);
			});
			clFileSvc.fileMap = clFileSvc.files.reduce(function(fileMap, fileDao) {
				return (fileMap[fileDao.id] = fileDao, fileMap);
			}, {});
			clFileSvc.localFiles = clFileSvc.files.filter(function(fileDao) {
				return fileDao.contentDao.isLocal;
			});

			clFileSvc.localFiles.sort(function(fileDao1, fileDao2) {
				return fileDao2.contentDao.lastChange - fileDao1.contentDao.lastChange;
			}).splice(maxLocalFiles).forEach(function(fileDao) {
				fileDao.unload();
				fileDao.contentDao.isLocal = '';
				fileDao.writeContent();
			});
		}

		function checkAll() {
			// Check file id list
			var checkFileSvcUpdate = clFileSvc.$checkUpdate();
			clFileSvc.$readUpdate();
			if (checkFileSvcUpdate && clFileSvc.$check()) {
				clFileSvc.fileIds = undefined;
			} else {
				clFileSvc.$write();
			}

			// Check every file
			var checkFileUpdate = fileDaoProto.$checkGlobalUpdate();
			fileDaoProto.$readGlobalUpdate();
			var checkContentUpdate = contentDaoProto.$checkGlobalUpdate();
			contentDaoProto.$readGlobalUpdate();
			clFileSvc.files.forEach(function(fileDao) {
				if (checkFileUpdate && fileDao.$checkUpdate()) {
					fileDao.read();
				} else {
					fileDao.write();
				}
				if (checkContentUpdate && fileDao.contentDao.$checkUpdate()) {
					fileDao.unload();
					fileDao.readContent();
				} else {
					fileDao.writeContent();
				}
			});

			if (checkFileSvcUpdate || checkFileUpdate || checkContentUpdate) {
				init();
				return true;
			}
		}

		function createFile(id) {
			id = id || clUid();
			var fileDao = new FileDao(id);
			fileDao.contentDao.isLocal = '1';
			fileDao.writeContent(true);
			clFileSvc.fileMap[id] = fileDao;
			clFileSvc.fileIds.push(id);
			init();
			return fileDao;
		}

		function createPublicFile(id) {
			var fileDao = new FileDao(id);
			fileDao.isPublic = '1';
			// File is added to the list by sync module
			return fileDao;
		}

		function createReadOnlyFile(name, content) {
			return new ReadOnlyFile(name, content);
		}

		function removeFiles(fileDaoList) {
			if (!fileDaoList.length) {
				return;
			}
			var fileIds = {};
			fileDaoList.forEach(function(fileDao) {
				fileDao.unload();
				fileIds[fileDao.id] = 1;
			});
			clFileSvc.fileIds = clFileSvc.fileIds.filter(function(fileId) {
				return !fileIds.hasOwnProperty(fileId);
			});
			init();
		}

		function updateFiles(changes) {
			changes.forEach(function(change) {
				var fileDao = clFileSvc.fileMap[change.id];
				if (change.deleted && fileDao) {
					fileDao.unload();
					var index = clFileSvc.files.indexOf(fileDao);
					clFileSvc.fileIds.splice(index, 1);
				} else if (!change.deleted && !fileDao) {
					fileDao = new FileDao(change.id);
					clFileSvc.fileMap[change.id] = fileDao;
					clFileSvc.fileIds.push(change.id);
				}
				fileDao.name = change.name || '';
				fileDao.folderId = change.folderId || '';
				fileDao.sharing = change.sharing || '';
				fileDao.write(change.updated);
			});
			init();
		}

		clFileSvc.fileDaoProto = fileDaoProto;
		clFileSvc.init = init;
		clFileSvc.checkAll = checkAll;
		clFileSvc.createFile = createFile;
		clFileSvc.createPublicFile = createPublicFile;
		clFileSvc.createReadOnlyFile = createReadOnlyFile;
		clFileSvc.removeFiles = removeFiles;
		clFileSvc.updateFiles = updateFiles;
		clFileSvc.fileMap = {};

		init();
		return clFileSvc;
	});
