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
				template: '<cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $location, clFileSvc, clEditorLayoutSvc, clToast) {
					var fileDao = clFileSvc.fileMap[$routeParams.fileId];
					if (!fileDao) {
						clToast('Unknown file ID.');
						return $location.url('');
					}
					$scope.setCurrentFileDao(fileDao);
					if (!fileDao.load()) {
						clToast('You appear to be offline.');
						return $location.url('');
					}
					$scope.$watch('currentFileDao.state', function(state) {
						if (!state) {
							return $location.url('');
						}
						if (state === 'loaded') {
							clEditorLayoutSvc.init();
							$scope.fileLoaded = true;
						}
					});
				}
			})
			.when('/file/:userId/:fileId', {
				template: '<cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $location, clFileSvc, clUserSvc, clEditorLayoutSvc, clToast) {
					var publicFileDao = clFileSvc.createPublicFile($routeParams.userId, $routeParams.fileId);
					var fileDao = clFileSvc.fileMap[$routeParams.fileId] || publicFileDao;
					if (fileDao.userId !== publicFileDao.userId) {
						return $scope.changeCurrentFile(fileDao);
					}
					$scope.setCurrentFileDao(fileDao);
					if (!fileDao.load()) {
						clToast('You appear to be offline.');
						return $location.url('');
					}
					$scope.$watch('currentFileDao.state', function(state) {
						if (!state) {
							return $location.url('');
						}
						if (state === 'loaded') {
							clEditorLayoutSvc.init(true);
							$scope.fileLoaded = true;
						}
					});
				}
			})
			.when('/doc/:fileName', {
				template: '<cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $timeout, clDocFileSvc, clEditorLayoutSvc) {
					var fileDao = clDocFileSvc($routeParams.fileName);
					$scope.setCurrentFileDao(fileDao);
					$timeout(function() {
						if (fileDao === $scope.currentFileDao) {
							clEditorLayoutSvc.init();
							$scope.fileLoaded = true;
						}
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
			if ($rootScope.currentFileDao && !$rootScope.currentFileDao.state) {
				// Close current file if it has been unloaded
				changeCurrentFile();
				hasChanged = true;
			}
			return hasChanged;
		}

		function setCurrentFileDao(fileDao) {
			$rootScope.currentFileDao = fileDao;
		}

		function unloadCurrentFile() {
			$rootScope.currentFileDao && $rootScope.currentFileDao.unload();
			$rootScope.currentFileDao = undefined;
		}

		function changeCurrentFile(fileDao) {
			unloadCurrentFile();
			$location.url(fileDao ? '/file/' + (fileDao.userId && fileDao.userId + '/') + fileDao.id : '');
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
				['content', 'state', 'discussions'].forEach(function(attrName) {
					newFileDao.contentDao[attrName] = oldFileDao.contentDao[attrName];
				});
				changeCurrentFile(newFileDao);
				clToast('Copy created.');
			});
		}

		$rootScope.saveAll = saveAll;
		$rootScope.changeCurrentFile = changeCurrentFile;
		$rootScope.setCurrentFileDao = setCurrentFileDao;
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
