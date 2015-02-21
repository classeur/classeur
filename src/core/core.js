angular.module('classeur.core', [])
	.config(function($mdThemingProvider, $routeProvider) {
		$mdThemingProvider.theme('default')
			.primaryPalette('blue')
			.accentPalette('blue');
		var menuTheme = $mdThemingProvider.theme('classeur', 'default');
		menuTheme.dark();
		menuTheme.foregroundShadow = '';

		$routeProvider
			.when('/file/:fileId', {
				template: '<cl-editor-layout ng-if="currentFileDao.isLoaded"></cl-editor-layout>',
				controller: function($rootScope, $routeParams, $location, clFileSvc, clEditorLayoutSvc, clToast) {
					$rootScope.currentFileDao = clFileSvc.fileMap[$routeParams.fileId];
					if(!$rootScope.currentFileDao) {
						return $location.url('');
					}
					$rootScope.currentFileDao.load(function(err) {
						if(err) {
							clToast(err);
							return $location.url('');
						}
						clEditorLayoutSvc.init();
					});
				}
			})
			.when('/doc/:fileName', {
				template: '<cl-editor-layout ng-if="currentFileDao.isLoaded"></cl-editor-layout>',
				controller: function($rootScope, $routeParams, $timeout, clDocFileSvc, clEditorLayoutSvc) {
					$rootScope.currentFileDao = clDocFileSvc($routeParams.fileName);
					$timeout(function() {
						$rootScope.currentFileDao.isLoaded = true;
						clEditorLayoutSvc.init();
					});
				}
			})
			.when('/state/:stateId', {
				template: '',
				controller: function($location, clStateMgr) {
					clStateMgr.token = $location.search().token;
					$location.url(clStateMgr.checkedState ? clStateMgr.checkedState.url : '');
				}
			})
			.when('/newUser', {
				template: '<cl-new-user-form></cl-new-user-form>'
			})
			.otherwise({
				template: '<cl-explorer-layout></cl-explorer-layout>'
			});

	})
	.run(function($rootScope, $location, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clUserSvc, clUserInfoSvc, clSyncSvc, clStateMgr, clToast, clSetInterval) {

		// Globally accessible services
		$rootScope.explorerLayoutSvc = clExplorerLayoutSvc;
		$rootScope.editorLayoutSvc = clEditorLayoutSvc;
		$rootScope.settingSvc = clSettingSvc;
		$rootScope.editorSvc = clEditorSvc;
		$rootScope.fileSvc = clFileSvc;
		$rootScope.folderSvc = clFolderSvc;
		$rootScope.userSvc = clUserSvc;
		$rootScope.userInfoSvc = clUserInfoSvc;
		$rootScope.syncSvc = clSyncSvc;

		function saveAll() {
			var hasChanged = clFileSvc.checkAll() | clFolderSvc.checkAll();
			if($rootScope.currentFileDao && !$rootScope.currentFileDao.isLoaded && !$rootScope.currentFileDao.onLoaded) {
				// Close current file if it has been unloaded
				setCurrentFile();
				hasChanged = true;
			}
			return hasChanged;
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
			var newFileDao = clFileSvc.createFile();
			newFileDao.load(function() {
				newFileDao.name = oldFileDao.name;
				['content', 'state', 'users', 'discussions'].forEach(function(attrName) {
					newFileDao.contentDao[attrName] = oldFileDao.contentDao[attrName];
				});
				setCurrentFile(newFileDao);
				clToast('Copy created.');
			});
		}

		$rootScope.saveAll = saveAll;
		$rootScope.setCurrentFile = setCurrentFile;
		$rootScope.setDocFile = setDocFile;
		$rootScope.makeCurrentFileCopy = makeCurrentFileCopy;

		clSetInterval(function() {
			var hasChanged = saveAll();
			hasChanged && $rootScope.$apply();
		}, 1000);

		window.addEventListener('beforeunload', function(evt) {
			saveAll();
			//evt.returnValue = 'Are you sure?';
		});

	});
