angular.module('classeur.core.files', [])
	.factory('clFileSvc',
		function($window, $timeout, clLocalStorage, clUid, clLocalStorageObject, clSocketSvc) {
			var maxLocalFiles = 3;
			var fileDaoProto = clLocalStorageObject('f', {
				name: {},
				folderId: {},
				sharing: {},
				isPublic: {},
				deleted: {
					default: '0',
					parser: parseInt
				},
			}, true);
			var contentDaoProto = clLocalStorageObject('c', {
				isLocal: {},
				lastChange: {
					default: '0',
					parser: parseInt
				},
				text: {},
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
				comments: {
					default: '[]',
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
					this.contentDao.$read.text();
					this.contentDao.$read.properties();
					this.contentDao.$read.discussions();
					this.contentDao.$read.comments();
					this.contentDao.$read.state();
				}
				this.contentDao.$readUpdate();
			};

			FileDao.prototype.freeContent = function() {
				this.contentDao.$free.text();
				this.contentDao.$free.properties();
				this.contentDao.$free.discussions();
				this.contentDao.$free.comments();
				this.contentDao.$free.state();
			};

			FileDao.prototype.writeContent = function(updateLastChange) {
				this.contentDao.$write.isLocal();
				if (this.state === 'loaded') {
					updateLastChange |= this.contentDao.$write.text();
					updateLastChange |= this.contentDao.$write.properties();
					updateLastChange |= this.contentDao.$write.discussions();
					updateLastChange |= this.contentDao.$write.comments();
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
							this.state = 'loaded'; // Need to set this before readContent
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
					text: content,
					state: {},
					properties: {},
					discussions: {},
					comments: {}
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
				deleted: true,
			};

			var contentAuthorizedKeys = {
				u: true,
				lastChange: true,
				isLocal: true,
				text: true,
				properties: true,
				discussions: true,
				comments: true,
				state: true,
			};

			var isInitialized;

			function init() {
				if (!clFileSvc.fileIds) {
					clFileSvc.$read();
				}

				var fileMap = {};
				var deletedFileMap = {};
				clFileSvc.fileIds = clFileSvc.fileIds.filter(function(id) {
					var fileDao = clFileSvc.fileMap[id] || clFileSvc.deletedFileMap[id] || new FileDao(id);
					return (!fileDao.deleted && !fileMap.hasOwnProperty(id) && (fileMap[id] = fileDao)) ||
						(fileDao.deleted && !deletedFileMap.hasOwnProperty(id) && (deletedFileMap[id] = fileDao));
				});

				clFileSvc.files.forEach(function(fileDao) {
					!fileMap.hasOwnProperty(fileDao.id) && fileDao.unload();
				});

				clFileSvc.files = Object.keys(fileMap).map(function(id) {
					return fileMap[id];
				});
				clFileSvc.fileMap = fileMap;

				clFileSvc.deletedFiles = Object.keys(deletedFileMap).map(function(id) {
					return deletedFileMap[id];
				});
				clFileSvc.deletedFileMap = deletedFileMap;

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

				if (!isInitialized) {
					var fileKeyPrefix = /^f\.(\w+)\.(\w+)/;
					var contentKeyPrefix = /^c\.(\w+)\.(\w+)/;
					Object.keys(clLocalStorage).forEach(function(key) {
						var fileDao, match = key.match(fileKeyPrefix);
						if (match) {
							if ((!clFileSvc.fileMap.hasOwnProperty(match[1]) && !clFileSvc.deletedFileMap.hasOwnProperty(match[1])) ||
								!fileAuthorizedKeys.hasOwnProperty(match[2])) {
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
					isInitialized = true;
				}
			}

			function write() {
				clFileSvc.$write();
				clFileSvc.files.forEach(function(fileDao) {
					fileDao.write();
					fileDao.writeContent();
				});
			}

			function checkAll(skipWrite) {
				// Check file id list
				var checkFileSvcUpdate = clFileSvc.$checkUpdate();
				clFileSvc.$readUpdate();
				if (checkFileSvcUpdate && clFileSvc.$check()) {
					clFileSvc.fileIds = undefined;
				} else if (!skipWrite) {
					clFileSvc.$write();
				}

				// Check every file
				var checkFileUpdate = fileDaoProto.$checkGlobalUpdate();
				fileDaoProto.$readGlobalUpdate();
				var checkContentUpdate = contentDaoProto.$checkGlobalUpdate();
				contentDaoProto.$readGlobalUpdate();
				clFileSvc.files.concat(clFileSvc.deletedFiles).forEach(function(fileDao) {
					if (checkFileUpdate && fileDao.$checkUpdate()) {
						fileDao.read();
					} else if (!skipWrite) {
						fileDao.write();
					}
					if (checkContentUpdate && fileDao.contentDao.$checkUpdate()) {
						fileDao.unload();
						fileDao.readContent();
					} else if (!skipWrite) {
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
				var fileDao = clFileSvc.deletedFileMap[id] || new FileDao(id);
				fileDao.deleted = 0;
				fileDao.isSelected = false;
				fileDao.contentDao.isLocal = '1';
				fileDao.writeContent(true);
				clFileSvc.fileIds.push(id);
				clFileSvc.fileMap[id] = fileDao;
				init();
				return fileDao;
			}

			function createPublicFile(id) {
				var fileDao = clFileSvc.deletedFileMap[id] || new FileDao(id);
				fileDao.deleted = 0;
				fileDao.isSelected = false;
				fileDao.isPublic = '1';
				// Added to the list by sync module
				return fileDao;
			}

			function createReadOnlyFile(name, content) {
				return new ReadOnlyFile(name, content);
			}

			function removeFiles(fileDaoList) {
				if (!fileDaoList.length) {
					return;
				}
				var fileIds = fileDaoList.reduce(function(fileIds, fileDao) {
					return (fileIds[fileDao.id] = 1, fileIds);
				}, {});
				clFileSvc.fileIds = clFileSvc.fileIds.filter(function(fileId) {
					return !fileIds.hasOwnProperty(fileId);
				});
				init();
			}

			function setDeletedFiles(fileDaoList) {
				if (!fileDaoList.length) {
					return;
				}
				var currentDate = Date.now();
				fileDaoList.forEach(function(fileDao) {
					fileDao.deleted = currentDate;
				});
				init();
			}

			function updateUserFiles(changes) {
				changes.forEach(function(change) {
					var fileDao = clFileSvc.fileMap[change.id];
					if (change.deleted && fileDao) {
						fileDao.unload();
						clFileSvc.fileMap[change.id] = undefined;
						var index = clFileSvc.files.indexOf(fileDao);
						clFileSvc.fileIds.splice(index, 1);
					} else if (!change.deleted && !fileDao) {
						fileDao = new FileDao(change.id);
						fileDao.deleted = 0;
						clFileSvc.fileMap[change.id] = fileDao;
						clFileSvc.fileIds.push(change.id);
					}
					fileDao.name = change.name || '';
					fileDao.folderId = change.folderId || '';
					fileDao.sharing = change.sharing || '';
					fileDao.isPublic = '';
					fileDao.write(change.updated);
				});
				init();
			}

			function getLastUpdated() {
				return fileDaoProto.gUpdated || 0;
			}

			clFileSvc.FileDao = FileDao;
			clFileSvc.init = init;
			clFileSvc.write = write;
			clFileSvc.checkAll = checkAll;
			clFileSvc.createFile = createFile;
			clFileSvc.createPublicFile = createPublicFile;
			clFileSvc.createReadOnlyFile = createReadOnlyFile;
			clFileSvc.removeFiles = removeFiles;
			clFileSvc.setDeletedFiles = setDeletedFiles;
			clFileSvc.updateUserFiles = updateUserFiles;
			clFileSvc.getLastUpdated = getLastUpdated;
			clFileSvc.files = [];
			clFileSvc.deletedFiles = [];
			clFileSvc.fileMap = {};
			clFileSvc.deletedFileMap = {};

			init();
			return clFileSvc;
		});
