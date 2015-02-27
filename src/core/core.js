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
				template: '<cl-spinner ng-if="!fileLoaded"></cl-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $location, clFileSvc, clEditorLayoutSvc, clEditorSvc, clToast) {
					var fileDao = clFileSvc.fileMap[$routeParams.fileId];
					if (!fileDao) {
						clToast('Unknown file ID.');
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
						}
						if (state === 'loaded') {
							clEditorLayoutSvc.init();
							$scope.fileLoaded = true;
						}
					});
					var lastSectionMeasured = clEditorSvc.lastSectionMeasured;
					var unwatch = $scope.$watch('editorSvc.lastSectionMeasured', function(value) {
						if(value !== lastSectionMeasured) {
							clEditorSvc.goToAnchor($location.hash());
							unwatch();
						}
					});
				}
			})
			.when('/file/:userId/:fileId', {
				template: '<cl-spinner ng-if="!fileLoaded"></cl-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $location, clFileSvc, clUserSvc, clEditorLayoutSvc, clEditorSvc, clToast) {
					var publicFileDao = clFileSvc.createPublicFile($routeParams.userId, $routeParams.fileId);
					var fileDao = clFileSvc.fileMap[$routeParams.fileId] || publicFileDao;
					if (fileDao.userId !== publicFileDao.userId) {
						return $scope.setCurrentFile(fileDao, $location.hash());
					}
					$scope.loadFile(fileDao);
					if (!fileDao.state) {
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
					var lastSectionMeasured = clEditorSvc.lastSectionMeasured;
					var unwatch = $scope.$watch('editorSvc.lastSectionMeasured', function(value) {
						if(value !== lastSectionMeasured) {
							clEditorSvc.goToAnchor($location.hash());
							unwatch();
						}
					});
				}
			})
			.when('/doc/:fileName', {
				template: '<cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: function($scope, $routeParams, $timeout, $location, clDocFileSvc, clEditorLayoutSvc, clEditorSvc) {
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
					var lastSectionMeasured = clEditorSvc.lastSectionMeasured;
					var unwatch = $scope.$watch('editorSvc.lastSectionMeasured', function(value) {
						if(value !== lastSectionMeasured) {
							clEditorSvc.goToAnchor($location.hash());
							unwatch();
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
	.run(function($rootScope, $location, $timeout, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clUserSvc, clUserInfoSvc, clSyncSvc, clStateMgr, clToast, clSetInterval, clUrl) {

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
			return hasChanged;
		}

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

		function setDocFile(fileName) {
			unloadCurrentFile();
			$timeout(function() {
				$location.url('/doc/' + fileName);
			});
		}

		function makeCurrentFileCopy() {
			var oldFileDao = $rootScope.currentFileDao;
			var newFileDao = clFileSvc.createFile();
			newFileDao.state = 'loaded';
			newFileDao.readContent();
			newFileDao.name = oldFileDao.name;
			['content', 'state', 'discussions'].forEach(function(attrName) {
				newFileDao.contentDao[attrName] = oldFileDao.contentDao[attrName];
			});
			newFileDao.writeContent();
			setCurrentFile(newFileDao);
			clToast('Copy created.');
		}

		$rootScope.saveAll = saveAll;
		$rootScope.setCurrentFile = setCurrentFile;
		$rootScope.loadFile = loadFile;
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
