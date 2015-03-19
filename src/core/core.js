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
			.when('/file/:fileId', {
				template: '<cl-spinner ng-if="!fileLoaded"></cl-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: 'ClEditorController'
			})
			.when('/file/:userId/:fileId', {
				template: '<cl-spinner ng-if="!fileLoaded"></cl-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
				controller: 'ClEditorController'
			})
			.when('/doc/:fileName', {
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
	.controller('ClEditorController', function($scope, $routeParams, $location, $mdDialog, clToast, clFileSvc, clEditorLayoutSvc) {
		var publicFileDao = $routeParams.userId && clFileSvc.createPublicFile($routeParams.userId, $routeParams.fileId);
		var fileDao = clFileSvc.fileMap[$routeParams.fileId] || publicFileDao;
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
				clEditorLayoutSvc.init(!!publicFileDao);
				$scope.fileLoaded = true;
			}
		});
	})
	.run(function($window, $rootScope, $location, $timeout, $route, $mdDialog, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clClasseurSvc, clUserSvc, clSocketSvc, clUserInfoSvc, clSyncSvc, clStateMgr, clToast, clSetInterval, clUrl, clConstants) {

		// Globally accessible services
		$rootScope.explorerLayoutSvc = clExplorerLayoutSvc;
		$rootScope.editorLayoutSvc = clEditorLayoutSvc;
		$rootScope.settingSvc = clSettingSvc;
		$rootScope.editorSvc = clEditorSvc;
		$rootScope.fileSvc = clFileSvc;
		$rootScope.folderSvc = clFolderSvc;
		$rootScope.classeurSvc = clClasseurSvc;
		$rootScope.socketSvc = clSocketSvc;
		$rootScope.userSvc = clUserSvc;
		$rootScope.userInfoSvc = clUserInfoSvc;
		$rootScope.syncSvc = clSyncSvc;

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
			['txt', 'state', 'discussions'].forEach(function(attrName) {
				newFileDao.contentDao[attrName] = oldFileDao.contentDao[attrName];
			});
			newFileDao.writeContent();
			setCurrentFile(newFileDao);
			clToast('Copy created.');
		}

		function signin() {
			var params = {
				client_id: clConstants.googleClientId,
				response_type: 'code',
				redirect_uri: clConstants.serverUrl + '/oauth/google/callback',
				scope: 'email',
				state: clStateMgr.saveState({
					url: '/newUser'
				}),
			};
			params = Object.keys(params).map(function(key) {
				return key + '=' + encodeURIComponent(params[key]);
			}).join('&');
			$window.location.href = 'https://accounts.google.com/o/oauth2/auth?' + params;
		}

		function saveAll() {
			return clUserSvc.checkAll() | clFileSvc.checkAll() | clFolderSvc.checkAll() | clClasseurSvc.checkAll();
		}

		$rootScope.saveAll = saveAll;
		$rootScope.setCurrentFile = setCurrentFile;
		$rootScope.loadFile = loadFile;
		$rootScope.setDocFile = setDocFile;
		$rootScope.makeCurrentFileCopy = makeCurrentFileCopy;
		$rootScope.signin = signin;

		$rootScope.$watch('currentFileDao.name', function(name) {
			$window.document.title = name || 'Classeur';
		});

		var hasToken = clSocketSvc.hasToken;
		$rootScope.$watch('socketSvc.hasToken', function(value) {
			if (!value && value !== hasToken) {
				var clearDataDialog = $mdDialog.confirm()
					.title('You\'ve been signed out')
					.content('Would you like to clean all your local files?')
					.ariaLabel('Clean local data')
					.ok('Yes please')
					.cancel('No thanks');
				$mdDialog.show(clearDataDialog).then(function() {
					localStorage.clear();
				});
			}
			hasToken = value;
		});

		$rootScope.$on('$routeChangeSuccess', function() {
			$mdDialog.cancel();
			clExplorerLayoutSvc.init();
		});

		clSetInterval(function() {
			saveAll() && $rootScope.$apply();
		}, 1100);

		$window.addEventListener('beforeunload', function(evt) {
			saveAll();
			//evt.returnValue = 'Are you sure?';
		});
	});
