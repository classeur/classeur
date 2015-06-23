angular.module('classeur.optional.electron', [])
	.config(
		function($routeProvider) {
			var clElectron = window.clElectron;
			if (!clElectron) {
				return;
			}

			$routeProvider
				.when('/localFile', {
					template: '<cl-centered-spinner ng-if="!fileLoaded"></cl-centered-spinner><cl-editor-layout ng-if="fileLoaded"></cl-editor-layout>',
					controller: function($scope, $timeout, $location, clFileSvc, clUid, clEditorLayoutSvc, clElectronSvc, clDialog, clEditorSvc) {
						function unimplemented() {
							throw new Error('Unimplemented');
						}
						var fileDao = new clFileSvc.FileDao(clUid());
						fileDao.isLocalFile = true;
						fileDao.path = clElectronSvc.watchedFile.path;
						fileDao.name = clElectronSvc.watchedFile.path.split(/[\\\/]/).slice(-1)[0];
						fileDao.read = unimplemented;
						fileDao.write = unimplemented;
						fileDao.readContent = unimplemented;
						fileDao.freeContent = unimplemented;
						fileDao.writeContent = unimplemented;
						fileDao.load = function() {
							if (this.state) {
								return;
							}
							this.state = 'loading';
							$timeout((function() {
								if (this.state === 'loading') {
									this.contentDao.text = clElectronSvc.watchedFile.content;
									this.contentDao.properties = {};
									this.contentDao.discussions = {};
									this.contentDao.state = {};
									this.state = 'loaded';
								}
							}).bind(this));
						};
						fileDao.unload = function() {
							clElectron.stopWatching(this.path);
							this.state = undefined;
						};
						$scope.loadFile(fileDao);
						$scope.$watch('currentFileDao.state', function(state) {
							if (!state) {
								return $location.url('');
							} else if (state === 'loaded') {
								var lastRead = clElectronSvc.watchedFile.lastRead;
								$scope.$watch('electronSvc.watchedFile.lastRead', function(value) {
									if (lastRead !== value && fileDao.path === clElectronSvc.watchedFile.path) {
										var reloadDialog = clDialog.confirm()
											.title('Reload from disk')
											.content('The file has been modified externally.')
											.ariaLabel('Reload from disk')
											.ok('Reload')
											.cancel('Discard');
										clDialog.show(reloadDialog).then(function() {
											clEditorSvc.setContent(clElectronSvc.watchedFile.content);
										});
									}
								});
								clEditorLayoutSvc.init();
								$scope.fileLoaded = true;
							}
						});
					}
				});
		})
	.run(
		function($window, $rootScope, $location, $timeout, clElectronSvc, clToast, clSetInterval) {
			var clElectron = $window.clElectron;
			if (!clElectron) {
				return;
			}

			clElectron.addEventListener('error', function(error) {
				clToast(error);
				$rootScope.$apply();
			});

			$rootScope.electronSvc = clElectronSvc;
			$rootScope.$watch('electronSvc.watchedFile.path', function(path) {
				if (path) {
					$rootScope.currentFileDao && $rootScope.currentFileDao.unload();
					$rootScope.currentFileDao = undefined;
					$timeout(function() {
						$location.url('/localFile');
					});
				}
			});

			clElectron.addEventListener('file', function(file) {
				clElectronSvc.watchedFile = {
					path: file.path,
					content: file.content,
					lastRead: Date.now()
				};
				$rootScope.$apply();
			});

			clSetInterval(function() {
				if (clElectronSvc.watchedFile && $rootScope.currentFileDao && clElectronSvc.watchedFile.path === $rootScope.currentFileDao.path) {
					var content = $rootScope.currentFileDao.contentDao.text;
					clElectron.saveFile({
						path: clElectronSvc.watchedFile.path,
						content: content
					});
				}
			}, 1000);

			$window.document.body.addEventListener('dragover', function(evt) {
				evt.preventDefault();
			});

			$window.document.body.addEventListener('drop', function(evt) {
				evt.preventDefault();
				var files = evt.dataTransfer.files;
				files && files[0] && clElectron.startWatching(files[0].path);
			});


			clElectron.addEventListener('version', function(version) {
				console.log(version);
				$rootScope.$apply();
			});

			// Tells the app is ready 
			clElectron.getVersion();
		})
	.factory('clElectronSvc', function() {
		return {};
	});
