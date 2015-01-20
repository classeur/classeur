angular.module('classeur.core', [])
	.config(function($routeProvider) {

		$routeProvider
			.when('/file/:fileId', {
				template: '<cl-editor-layout ng-if="currentFileDao"></cl-editor-layout>',
				controller: function($rootScope, $routeParams, clFileSvc) {
					var currentFileDao = clFileSvc.localFileMap[$routeParams.fileId];
					currentFileDao.load(function() {
						$rootScope.currentFileDao = currentFileDao;
					});
				}
			})
			.when('/doc/:fileName', {
				template: '<cl-editor-layout ng-if="currentFileDao"></cl-editor-layout>',
				controller: function($rootScope, $routeParams, $timeout, clDocFileSvc) {
					var currentFileDao = clDocFileSvc($routeParams.fileName);
					$timeout(function() {
						$rootScope.currentFileDao = currentFileDao;
					});
				}
			})
			.otherwise({
				template: '<cl-explorer-layout></cl-explorer-layout>'
			});
	})
	.run(function($rootScope, $location, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clToast) {
		clFileSvc.init();
		clFolderSvc.init();
		var lastModificationKey = 'cl.lastStorageModification';
		var lastModification = localStorage[lastModificationKey];

		// Globally accessible services
		$rootScope.explorerLayoutSvc = clExplorerLayoutSvc;
		$rootScope.editorLayoutSvc = clEditorLayoutSvc;
		$rootScope.settingSvc = clSettingSvc;
		$rootScope.editorSvc = clEditorSvc;
		$rootScope.fileSvc = clFileSvc;
		$rootScope.folderSvc = clFolderSvc;

		function saveAll() {
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
					setCurrentFile();
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

		function unloadCurrentFile() {
			$rootScope.currentFileDao && $rootScope.currentFileDao.unload();
			$rootScope.currentFileDao = undefined;
		}

		function setCurrentFile(fileDao) {
			unloadCurrentFile();
			$location.url(fileDao ? '/file/' + fileDao.id : '');
		}

		function setDocFile(fileName) {
			unloadCurrentFile();
			$location.url('/doc/' + fileName);
		}

		function makeCurrentFileCopy() {
			var oldFileDao = $rootScope.currentFileDao;
			var newFileDao = clFileSvc.createLocalFile();
			newFileDao.load(function() {
				['title', 'content', 'state', 'users', 'discussions'].forEach(function(attrName) {
					newFileDao[attrName] = oldFileDao[attrName];
				});
				setCurrentFile(newFileDao);
				clToast('Copy created.');
			});
		}

		$rootScope.saveAll = saveAll;
		$rootScope.setCurrentFile = setCurrentFile;
		$rootScope.setDocFile = setDocFile;
		$rootScope.makeCurrentFileCopy = makeCurrentFileCopy;

		setInterval(function() {
			var isStorageModified = saveAll();
			$rootScope.$broadcast('periodicRun');
			isStorageModified && $rootScope.$apply();
		}, 1000);

	});
