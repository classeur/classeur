angular.module('classeur.core', [])
	.config(
		function($routeProvider, $anchorScrollProvider, $locationProvider, $animateProvider, $mdThemingProvider) {
			$locationProvider.hashPrefix('!');
			$animateProvider.classNameFilter(/angular-animate|md-dialog-backdrop|md-bottom md-right/);
			$anchorScrollProvider.disableAutoScrolling();
			$mdThemingProvider.theme('default')
				.primaryPalette('blue')
				.accentPalette('blue');
			var menuTheme = $mdThemingProvider.theme('classeur', 'default');
			menuTheme.dark();
			menuTheme.foregroundShadow = '';
			window.BezierEasing.css.materialIn = window.BezierEasing(0.75, 0, 0.8, 0.25);
			window.BezierEasing.css.materialOut = window.BezierEasing(0.25, 0.8, 0.25, 1.0);

			$routeProvider
				.when('/files/:fileId', {
					template: '<cl-centered-spinner ng-if="::!fileLoaded"></cl-centered-spinner><cl-editor-layout ng-if="::fileLoaded"></cl-editor-layout>',
					controller: function($scope, $routeParams, $location, clAnalytics, clToast, clFileSvc, clEditorLayoutSvc) {
						clAnalytics.trackPage('/files');
						var publicFileDao = clFileSvc.createPublicFile($routeParams.fileId);
						var fileDao = clFileSvc.fileMap[$routeParams.fileId] || publicFileDao;
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
									fileDao === publicFileDao &&
									!$scope.currentFileDao.contentDao.state.selectionStart &&
									!$scope.currentFileDao.contentDao.state.selectionEnd
								);
								$scope.fileLoaded = true;
							}
						});
					}
				})
				.when('/folders/:folderId', {
					template: '',
					controller: function($location, $routeParams, clAnalytics, clClasseurSvc, clFolderSvc, clExplorerLayoutSvc) {
						clAnalytics.trackPage('/folders');
						clExplorerLayoutSvc.refreshFolders();
						var folderDao = clFolderSvc.folderMap[$routeParams.folderId];
						var classeurDao = clClasseurSvc.defaultClasseur;
						if (!folderDao) {
							folderDao = clFolderSvc.createPublicFolder($routeParams.folderId);
							classeurDao.folders.push(folderDao);
						} else {
							if (clExplorerLayoutSvc.currentClasseurDao.folders.indexOf(folderDao) !== -1) {
								classeurDao = clExplorerLayoutSvc.currentClasseurDao;
							} else {
								clClasseurSvc.classeurs.cl_some(function(classeurToScan) {
									if (classeurToScan.folders.indexOf(folderDao) !== -1) {
										classeurDao = classeurToScan;
										return true;
									}
								});
							}
						}
						clExplorerLayoutSvc.setCurrentClasseur(classeurDao);
						clExplorerLayoutSvc.setCurrentFolder(folderDao);
						$location.url('');
					}
				})
				.when('/states/:stateId', {
					template: '',
					controller: function($location, clStateMgr) {
						$location.url(clStateMgr.checkedState ? clStateMgr.checkedState.url : '');
					}
				})
				.when('/', {
					template: '<cl-explorer-layout ng-if="hasFiles"></cl-explorer-layout>',
					controller: function($scope, clAnalytics, clFileSvc, clSettingSvc, $templateCache) {
						if (clFileSvc.files.length === 0) {
							var newFileDao = clFileSvc.createFile();
							newFileDao.state = 'loaded';
							newFileDao.readContent();
							newFileDao.name = 'My first file';
							newFileDao.contentDao.text = $templateCache.get('core/explorerLayout/firstFile.md');
							newFileDao.contentDao.properties = clSettingSvc.values.defaultFileProperties || {};
							newFileDao.writeContent();
							return $scope.setCurrentFile(newFileDao);
						}
						$scope.hasFiles = true;
						clAnalytics.trackPage('/');
					}
				})
				.otherwise('/');

		})
	.run(
		function($window, $rootScope, $location, $timeout, $route, clDialog, clExplorerLayoutSvc, clEditorLayoutSvc, clSettingSvc, clLocalSettingSvc, clEditorSvc, clFileSvc, clFolderSvc, clClasseurSvc, clUserSvc, clSocketSvc, clUserInfoSvc, clSyncDataSvc, clSyncSvc, clContentSyncSvc, clToast, clUrl, clLocalStorage) {

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
			$rootScope.syncDataSvc = clSyncDataSvc;
			$rootScope.syncSvc = clSyncSvc;
			$rootScope.contentSyncSvc = clContentSyncSvc;
			$rootScope.settingSvc = clSettingSvc;
			$rootScope.localSettingSvc = clLocalSettingSvc;

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
				newFileDao.contentDao.text = oldFileDao.contentDao.text;
				newFileDao.contentDao.state = JSON.parse(JSON.stringify(oldFileDao.contentDao.state));
				newFileDao.contentDao.properties = JSON.parse(JSON.stringify(oldFileDao.contentDao.properties));
				newFileDao.contentDao.discussions = JSON.parse(JSON.stringify(oldFileDao.contentDao.discussions));
				newFileDao.contentDao.comments = JSON.parse(JSON.stringify(oldFileDao.contentDao.comments));
				newFileDao.contentDao.conflicts = JSON.parse(JSON.stringify(oldFileDao.contentDao.conflicts));
				newFileDao.writeContent();
				setCurrentFile(newFileDao);
				clToast('Copy created.');
			}

			$rootScope.unloadCurrentFile = unloadCurrentFile;
			$rootScope.setCurrentFile = setCurrentFile;
			$rootScope.loadFile = loadFile;
			$rootScope.makeCurrentFileCopy = makeCurrentFileCopy;

			$rootScope.$on('$routeChangeSuccess', function(event, current) {
				$timeout(function() {
					$rootScope.title = $rootScope.currentFileDao ? $rootScope.currentFileDao.name : current.$$route.title || 'Classeur';
				});
			});

			var hasToken = clSocketSvc.hasToken;
			$rootScope.$watch('socketSvc.hasToken', function(value) {
				if (!value && value !== hasToken) {
					var clearDataDialog = clDialog.confirm()
						.title('You\'ve been signed out')
						.content('Would you like to clean all your local data?')
						.ariaLabel('Clean local data')
						.ok('Yes please')
						.cancel('No thanks');
					clDialog.show(clearDataDialog).then(function() {
						clLocalStorage.clear();
						clSyncSvc.saveAll();
						clLocalSettingSvc.values.tourStep = -1;
					});
				}
				hasToken = value;
			});

			$rootScope.$on('$routeChangeSuccess', function() {
				clDialog.cancel();
				clExplorerLayoutSvc.init();
			});

			$window.addEventListener('beforeunload', function(evt) {
				clSyncSvc.saveAll();
				//evt.returnValue = 'Are you sure?';
			});
		});
