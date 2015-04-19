angular.module('classeur.core', [])
	.config(function($routeProvider, $anchorScrollProvider, $locationProvider, $animateProvider, $mdThemingProvider) {
		$locationProvider.hashPrefix('!');
		$animateProvider.classNameFilter(/angular-animate/);
		$anchorScrollProvider.disableAutoScrolling();
		$mdThemingProvider.theme('default')
			.primaryPalette('blue')
			.accentPalette('blue');
		var menuTheme = $mdThemingProvider.theme('classeur', 'default');
		menuTheme.dark();
		menuTheme.foregroundShadow = '';

		$routeProvider
			.when('/files/:fileId', {
				template: '<cl-spinner ng-if="!fileLoaded"></cl-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: 'ClEditorController'
			})
			.when('/users/:userId/files/:fileId', {
				template: '<cl-spinner ng-if="!fileLoaded"></cl-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: 'ClEditorController'
			})
			.when('/users/:userId/folders/:folderId', {
				template: '',
				controller: function($location, $routeParams, clClasseurSvc, clFolderSvc, clExplorerLayoutSvc) {
					clExplorerLayoutSvc.refreshFolders();
					var folderDao = clFolderSvc.folderMap[$routeParams.folderId];
					var classeurDao = clClasseurSvc.defaultClasseur;
					if (!folderDao) {
						folderDao = clFolderSvc.createPublicFolder($routeParams.userId, $routeParams.folderId);
						folderDao.removeOnFailure = true;
						classeurDao.folders.push(folderDao);
					} else {
						if (clExplorerLayoutSvc.currentClasseurDao.folders.indexOf(folderDao) !== -1) {
							classeurDao = clExplorerLayoutSvc.currentClasseurDao;
						} else {
							clClasseurSvc.classeurs.some(function(classeurToScan) {
								if (classeurToScan.folders.indexOf(folderDao) !== -1) {
									classeurDao = classeurToScan;
									return true;
								}
							});
						}
					}
					clExplorerLayoutSvc.setCurrentClasseur(classeurDao);
					clExplorerLayoutSvc.setCurrentFolder(folderDao);
					return $location.url('');
				}
			})
			.when('/docs/:fileName', {
				template: '<cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $timeout, $location, clDocFileSvc, clEditorLayoutSvc) {
					var fileDao = clDocFileSvc($routeParams.fileName);
					$scope.loadFile(fileDao);
					$timeout(function() {
						if (fileDao === $scope.currentFileDao) {
							clEditorLayoutSvc.init();
							$scope.fileLoaded = true;
						}
					});
					$scope.$watch('currentFileDao.state', function(state) {
						if (!state) {
							return $location.url('');
						}
					});
				}
			})
			.when('/states/:stateId', {
				template: '',
				controller: function($location, clStateMgr) {
					$location.url(clStateMgr.checkedState ? clStateMgr.checkedState.url : '');
				}
			})
			.when('/settings', {
				template: '<cl-settings-layout></cl-settings-layout>',
				reloadOnSearch: false
			})
			.when('/newUser', {
				template: '<cl-new-user-form></cl-new-user-form>'
			})
			.otherwise({
				template: '<cl-explorer-layout></cl-explorer-layout>'
			});

	})
	.controller('ClEditorController', function($scope, $routeParams, $location, $mdDialog, clToast, clFileSvc, clEditorLayoutSvc) {
		// TODO import current user file when not already synced
		var publicFileDao = $routeParams.userId && clFileSvc.createPublicFile($routeParams.userId, $routeParams.fileId);
		var fileDao = clFileSvc.fileMap[$routeParams.fileId] || publicFileDao;
		if (!fileDao) {
			clToast('Unknown file.');
			return $location.url('');
		}
		$scope.loadFile(fileDao);
		if (!fileDao.state) {
			clToast('You appear to be offline.');
			return $location.url('');
		}
		$scope.$watch('currentFileDao.state', function(state) {
			if (!state) {
				return $location.url('');
			} else if (state === 'loaded') {
				clEditorLayoutSvc.init(
					publicFileDao &&
					!$scope.currentFileDao.contentDao.state.selectionStart &&
					!$scope.currentFileDao.contentDao.state.selectionEnd
				);
				$scope.fileLoaded = true;
			}
		});
	})
	.run(function($window, $rootScope, $location, $timeout, $route, $mdDialog, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clClasseurSvc, clUserSvc, clSocketSvc, clUserInfoSvc, clSyncSvc, clToast, clSetInterval, clUrl, clLocalStorage) {

		// Globally accessible services
		$rootScope.explorerLayoutSvc = clExplorerLayoutSvc;
		$rootScope.editorLayoutSvc = clEditorLayoutSvc;
		$rootScope.editorSvc = clEditorSvc;
		$rootScope.fileSvc = clFileSvc;
		$rootScope.folderSvc = clFolderSvc;
		$rootScope.classeurSvc = clClasseurSvc;
		$rootScope.socketSvc = clSocketSvc;
		$rootScope.userSvc = clUserSvc;
		$rootScope.userInfoSvc = clUserInfoSvc;
		$rootScope.syncSvc = clSyncSvc;
		$rootScope.settings = clSettingSvc.settings;
		$rootScope.localSettings = clSettingSvc.localSettings;

		function loadFile(fileDao) {
			unloadCurrentFile();
			$rootScope.currentFileDao = fileDao;
			fileDao.load && fileDao.load();
		}

		function unloadCurrentFile() {
			$rootScope.currentFileDao && $rootScope.currentFileDao.unload();
			$rootScope.currentFileDao = undefined;
		}

		function setCurrentFile(fileDao, anchor) {
			unloadCurrentFile();
			fileDao && $timeout(function() {
				$location.url(clUrl.file(fileDao));
				$location.hash(anchor);
			});
		}

		function makeCurrentFileCopy() {
			var oldFileDao = $rootScope.currentFileDao;
			var newFileDao = clFileSvc.createFile();
			newFileDao.state = 'loaded';
			newFileDao.readContent();
			newFileDao.name = oldFileDao.name;
			newFileDao.contentDao.txt = oldFileDao.contentDao.txt;
			newFileDao.contentDao.state = JSON.parse(JSON.stringify(oldFileDao.contentDao.state));
			newFileDao.contentDao.properties = JSON.parse(JSON.stringify(oldFileDao.contentDao.properties));
			newFileDao.writeContent();
			setCurrentFile(newFileDao);
			clToast('Copy created.');
		}

		$rootScope.setCurrentFile = setCurrentFile;
		$rootScope.loadFile = loadFile;
		$rootScope.makeCurrentFileCopy = makeCurrentFileCopy;

		$rootScope.$watch('currentFileDao.name', function(name) {
			$window.document.title = name || 'Classeur';
		});

		var hasToken = clSocketSvc.hasToken;
		$rootScope.$watch('socketSvc.hasToken', function(value) {
			if (!value && value !== hasToken) {
				var clearDataDialog = $mdDialog.confirm()
					.title('You\'ve been signed out')
					.content('Would you like to clean all your local data?')
					.ariaLabel('Clean local data')
					.ok('Yes please')
					.cancel('No thanks');
				$mdDialog.show(clearDataDialog).then(function() {
					clLocalStorage.clear();
					clSyncSvc.saveAll();
				});
			}
			hasToken = value;
		});

		$rootScope.$on('$routeChangeSuccess', function() {
			$mdDialog.cancel();
			clExplorerLayoutSvc.init();
		});

		clSetInterval(function() {
			clSyncSvc.saveAll() && $rootScope.$apply();
		}, 1100);

		$window.addEventListener('beforeunload', function(evt) {
			clSyncSvc.saveAll();
			//evt.returnValue = 'Are you sure?';
		});
	});
