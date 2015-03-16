angular.module('classeur.core.classeurs', [])
	.factory('clClasseurSvc', function(clUid, clLocalStorageObject, clFolderSvc) {
		var clClasseurSvc = clLocalStorageObject('classeurSvc');

		function ClasseurDao(id, name) {
			this.id = id;
			this.name = name;
			this.folderIds = [];
		}

		clClasseurSvc.read = function() {
			this.$readAttr('classeurs', '[]', JSON.parse);
			this.$readLocalUpdate();
		};

		clClasseurSvc.write = function(updated) {
			this.$writeAttr('classeurs', function(data) {
				return JSON.stringify(data, function(id, value) {
					return id === 'folders' ? undefined : value;
				});
			}, updated);
		};

		function init() {
			clClasseurSvc.defaultClasseur = undefined;
			clClasseurSvc.classeurs.some(function(classeur) {
				if(classeur.isDefault) {
					clClasseurSvc.defaultClasseur = classeur;
					return true;
				}
			});
			if(!clClasseurSvc.defaultClasseur) {
				clClasseurSvc.defaultClasseur = new ClasseurDao(clUid(), 'Classeur');
				clClasseurSvc.classeurs.push(clClasseurSvc.defaultClasseur);
			}
			var foldersInClasseur = {};
			clClasseurSvc.classeurMap = {};
			clClasseurSvc.classeurs.forEach(function(classeur) {
				clClasseurSvc.classeurMap[classeur.id] = classeur;
				classeur.isDefault = undefined;
				classeur.folders = [];
				classeur.folderIds.forEach(function(folderId) {
					var folderDao = clFolderSvc.folderMap[folderId];
					if(folderDao) {
						classeur.folders.push(folderDao);
						foldersInClasseur[folderId] = true;
					}
				});
				classeur.folderIds = classeur.folders.map(function(folderDao) {
					return folderDao.id;
				});
			});
			clClasseurSvc.classeurs.sort(function(classeurDao1, classeurDao2) {
				return classeurDao1.name > classeurDao2.name;
			});
			clClasseurSvc.defaultClasseur.isDefault = true;
			clFolderSvc.folders.forEach(function(folderDao) {
				if(!foldersInClasseur.hasOwnProperty(folderDao.id)) {
					clClasseurSvc.defaultClasseur.folders.push(folderDao);
					clClasseurSvc.defaultClasseur.folderIds.push(folderDao.id);
				}
			});
		}

		function checkAll() {
			if (clClasseurSvc.$checkGlobalUpdate()) {
				clClasseurSvc.read();
				init();
				return true;
			} else {
				clClasseurSvc.write();
			}
		}

		function createClasseur() {
			var classeurDao = new ClasseurDao(clUid());
			clClasseurSvc.classeurs.push(classeurDao);
			init();
			return classeurDao;
		}

		clClasseurSvc.init = init;
		clClasseurSvc.checkAll = checkAll;
		clClasseurSvc.createClasseur = createClasseur;

		clClasseurSvc.read();
		init();
		return clClasseurSvc;
	});
