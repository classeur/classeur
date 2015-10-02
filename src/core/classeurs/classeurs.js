angular.module('classeur.core.classeurs', [])
	.factory('clClasseurSvc',
		function(clUid, clLocalStorageObject, clFolderSvc) {
			var clClasseurSvc = clLocalStorageObject('classeurSvc', {
				classeurs: {
					default: '[]',
					serializer: function(data) {
						return JSON.stringify(data, function(id, value) {
							return value instanceof ClasseurDao ? value.toStorable() : value;
						});
					},
					parser: function(data) {
						return JSON.parse(data).cl_map(function(item) {
							var classeurDao = new ClasseurDao();
							classeurDao.fromStorable(item);
							return classeurDao;
						});
					}
				}
			});

			function ClasseurDao(id, name) {
				this.id = id;
				this.name = name;
				this.folders = [];
			}

			ClasseurDao.prototype.toStorable = function() {
				return {
					folders: this.folders.cl_map(function(folderDao) {
						return folderDao.id;
					}),
					id: this.id,
					isDefault: this.isDefault,
					name: this.name
				};
			};

			ClasseurDao.prototype.fromStorable = function(item) {
				this.id = item.id;
				this.name = item.name;
				this.isDefault = item.isDefault;
				this.folders = item.folders.cl_reduce(function(result, folderId) {
					var folderDao = clFolderSvc.folderMap[folderId];
					if (!folderDao) {
						folderDao = clFolderSvc.createPublicFolder(folderId);
					}
					folderDao && result.push(folderDao);
					return result;
				}, []);
			};

			clClasseurSvc.read = function() {
				this.$read();
				this.$readUpdate();
			};

			clClasseurSvc.write = function(updated) {
				this.$write();
				updated && this.$writeUpdate(updated);
			};

			function init(serverClasseurs) {
				if (serverClasseurs) {
					clClasseurSvc.classeurs = serverClasseurs.cl_map(function(item) {
						var classeurDao = new ClasseurDao();
						classeurDao.fromStorable(item);
						return classeurDao;
					});
				}
				clClasseurSvc.defaultClasseur = undefined;
				clClasseurSvc.classeurs.cl_some(function(classeurDao) {
					if (classeurDao.isDefault) {
						clClasseurSvc.defaultClasseur = classeurDao;
						return true;
					}
				});
				if (!clClasseurSvc.defaultClasseur) {
					clClasseurSvc.defaultClasseur = new ClasseurDao(clUid(), 'Classeur');
					clClasseurSvc.classeurs.push(clClasseurSvc.defaultClasseur);
				}
				var foldersInClasseurs = {};
				clClasseurSvc.classeurMap = Object.create(null);
				clClasseurSvc.classeurs.cl_each(function(classeurDao) {
					clClasseurSvc.classeurMap[classeurDao.id] = classeurDao;
					classeurDao.isDefault = undefined;
					var foldersInClasseur = {};
					classeurDao.folders = classeurDao.folders.cl_filter(function(folderDao) {
						folderDao = clFolderSvc.folderMap[folderDao.id];
						if (folderDao && !foldersInClasseur.hasOwnProperty(folderDao.id)) {
							foldersInClasseur[folderDao.id] = true;
							foldersInClasseurs[folderDao.id] = true;
							return true;
						}
					});
				});
				clClasseurSvc.defaultClasseur.isDefault = true;
				clFolderSvc.folders.cl_each(function(folderDao) {
					if (!foldersInClasseurs.hasOwnProperty(folderDao.id)) {
						clClasseurSvc.defaultClasseur.folders.push(folderDao);
					}
				});
				clClasseurSvc.classeurs.sort(function(classeurDao1, classeurDao2) {
					// Sort deterministically
					return (classeurDao1.name + '\0' + classeurDao1.id).localeCompare(classeurDao2.name + '\0' + classeurDao2.id);
				}).cl_each(function(classeurDao) {
					classeurDao.folders.sort(function(folder1, folder2) {
						return folder1.id > folder2.id ? 1 : (folder1.id === folder2.id ? 0 : -1);
					});
				});
			}

			function checkAll() {
				if (clClasseurSvc.$checkUpdate()) {
					clClasseurSvc.read();
					init();
					return true;
				} else {
					clClasseurSvc.write();
				}
			}

			function createClasseur(name) {
				var classeurDao = new ClasseurDao(clUid());
				classeurDao.name = name;
				clClasseurSvc.classeurs.push(classeurDao);
				init();
				return classeurDao;
			}

			function removeClasseur(classeurToRemove) {
				clClasseurSvc.classeurs = clClasseurSvc.classeurs.cl_filter(function(classeurDao) {
					return classeurDao !== classeurToRemove;
				});
				init();
			}

			clClasseurSvc.init = init;
			clClasseurSvc.checkAll = checkAll;
			clClasseurSvc.createClasseur = createClasseur;
			clClasseurSvc.removeClasseur = removeClasseur;

			clClasseurSvc.read();
			init();
			return clClasseurSvc;
		});
