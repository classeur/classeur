angular.module('classeur.core.classeur', [])
	.directive('clClasseur', function(clClasseurLayoutSvc, clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc, clFolderSvc) {
		clFileSvc.init();
		clFolderSvc.init();
		var lastModificationKey = 'cl.lastStorageModification';
		var lastModification = localStorage[lastModificationKey];

		return {
			restrict: 'E',
			templateUrl: 'app/core/classeur/classeur.html',
			link: function(scope) {

				// Globally accessible services
				scope.classeurLayoutSvc = clClasseurLayoutSvc;
				scope.editorLayoutSvc = clEditorLayoutSvc;
				scope.settingSvc = clSettingSvc;
				scope.editorSvc = clEditorSvc;
				scope.fileSvc = clFileSvc;
				scope.folderSvc = clFolderSvc;

				function applyStorage() {
					var isStorageModified = lastModification !== localStorage[lastModificationKey];
					var isExternalFileChanged = clFileSvc.checkLocalFileIds(isStorageModified);
					var isExternalFolderChanged = clFolderSvc.checkFolderIds(isStorageModified);

					// Read/write file changes
					clFileSvc.localFiles.forEach(function(fileDao) {
						if(isStorageModified && fileDao.checkChanges()) {
							fileDao.read();
							isExternalFileChanged = true;
						}
						if(isStorageModified && fileDao.checkChanges(true)) {
							// Close current file
							fileDao.unload();
							scope.fileDao = undefined;
						}
						else {
							fileDao.write();
						}
					});

					// Read/write folder changes
					clFolderSvc.folders.forEach(function(folderDao) {
						if(isStorageModified && folderDao.checkChanges()) {
							folderDao.read();
							isExternalFolderChanged = true;
						}
						else {
							folderDao.write();
						}
					});

					isExternalFileChanged && clFileSvc.init();
					isExternalFolderChanged && clFolderSvc.init();

					isStorageModified = lastModification !== localStorage[lastModificationKey];
					lastModification = localStorage[lastModificationKey];
					return isStorageModified;
				}

				setInterval(function() {
					var isStorageModified = applyStorage();
					scope.$broadcast('periodicRun');
					isStorageModified && scope.$apply();
				}, 1000);

				// Set the current file
				scope.setFileDao = function(fileDao) {
					if(scope.fileDao && scope.fileDao.unload) {
						applyStorage();
						scope.fileDao.unload();
					}
					scope.fileDao = fileDao;
				};
			}
		};
	});
