angular.module('classeur.core.classeurs', [])
	.factory('clClasseurSvc', function(clUid, clLocalStorageObject, clFolderSvc) {
		var clClasseurSvc = clLocalStorageObject('classeurSvc');

		function ClasseurDao(id, name) {
			this.id = id;
			this.name = name;
			this.folders = [];
		}

		ClasseurDao.prototype.toStorable = function() {
			return {
				folders: this.folders.map(function(folderDao) {
					return {
						id: folderDao.id,
						userId: folderDao.userId || undefined
					};
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
			this.folders = item.folders.reduce(function(result, folder) {
				var folderDao = clFolderSvc.folderMap[folder.id];
				if (!folderDao && folder.userId) {
					folderDao = clFolderSvc.createPublicFolder(folder.userId, folder.id);
				}
				folderDao && result.push(folderDao);
				return result;
			}, []);
		};

		clClasseurSvc.read = function() {
			this.$readAttr('classeurs', '[]', function(data) {
				return JSON.parse(data).reduce(function(result, item) {
					var classeurDao = new ClasseurDao();
					classeurDao.fromStorable(item);
					result.push(classeurDao);
					return result;
				}, []);
			});
			this.$readUpdate();
		};

		clClasseurSvc.write = function(updated) {
			this.$writeAttr('classeurs', function(data) {
				return JSON.stringify(data, function(id, value) {
					return value instanceof ClasseurDao ? value.toStorable() : value;
				});
			}, updated);
		};

		function init(storedClasseurs) {
			if (storedClasseurs) {
				clClasseurSvc.classeurs = storedClasseurs.map(function(item) {
					var classeurDao = new ClasseurDao();
					classeurDao.fromStorable(item);
					return classeurDao;
				});
			}
			clClasseurSvc.defaultClasseur = undefined;
			clClasseurSvc.classeurs.some(function(classeur) {
				if (classeur.isDefault) {
					clClasseurSvc.defaultClasseur = classeur;
					return true;
				}
			});
			if (!clClasseurSvc.defaultClasseur) {
				clClasseurSvc.defaultClasseur = new ClasseurDao(clUid(), 'Classeur');
				clClasseurSvc.classeurs.push(clClasseurSvc.defaultClasseur);
			}
			var foldersInClasseurs = {};
			clClasseurSvc.classeurMap = {};
			clClasseurSvc.classeurs.forEach(function(classeur) {
				clClasseurSvc.classeurMap[classeur.id] = classeur;
				classeur.isDefault = undefined;
				var foldersInClasseur = {};
				classeur.folders = classeur.folders.filter(function(folderDao) {
					folderDao = clFolderSvc.folderMap[folderDao.id];
					if (folderDao && !foldersInClasseur.hasOwnProperty(folderDao.id)) {
						foldersInClasseur[folderDao.id] = true;
						foldersInClasseurs[folderDao.id] = true;
						return true;
					}
				});
			});
			clClasseurSvc.defaultClasseur.isDefault = true;
			clFolderSvc.folders.forEach(function(folderDao) {
				if (!foldersInClasseurs.hasOwnProperty(folderDao.id)) {
					clClasseurSvc.defaultClasseur.folders.push(folderDao);
				}
			});
			clClasseurSvc.classeurs.sort(function(classeurDao1, classeurDao2) {
				return (classeurDao1.name + '\0' + classeurDao1.id).localeCompare(classeurDao2.name + '\0' + classeurDao2.id);
			}).forEach(function(classeurDao) {
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
			clClasseurSvc.classeurs = clClasseurSvc.classeurs.filter(function(classeurDao) {
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
