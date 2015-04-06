angular.module('classeur.core.settingsLayout', [])
	.directive('clSettingsLayout', function($location, $mdDialog, clUserSvc, clToast, clStateMgr, clSocketSvc, clSyncSvc) {
		clSocketSvc.addMsgHandler('userLinked', function(msg) {
			clToast(msg.error ? 'An error occurred.' : 'Account successfully linked.');
		});

		return {
			restrict: 'E',
			templateUrl: 'core/settingsLayout/settingsLayout.html',
			link: function(scope) {
				var tabs = ['app', 'trash', 'user'];

				function serialize(obj) {
					return JSON.stringify(obj, function(key, value) {
						return key[0] === '$' ? undefined : value;
					});
				}

				function clone(obj) {
					return JSON.parse(serialize(obj));
				}

				var next;

				function reset() {
					scope.user = clone(clUserSvc.user);
					next && next();
				}

				function apply() {
					try {
						clUserSvc.updateUser(scope.user);
					} catch (e) {
						scope.selectedTabIndex = tabs.indexOf('user');
						return clToast(e);
					}
					next && next();
				}

				function checkModifications(tabIndex) {
					if (tabs[tabIndex] === 'user') {
						if (serialize(scope.user) !== serialize(clUserSvc.user)) {
							var applyUser = $mdDialog.confirm()
								.title('User settings')
								.content('You\'ve modified your user settings.')
								.ok('Apply')
								.cancel('Cancel');
							return $mdDialog.show(applyUser).then(apply, reset);
						}
					}
				}

				reset();

				scope.cancel = function() {
					next = function() {
						$location.url('/');
					};
					reset();
				};

				scope.apply = function() {
					next = function() {
						$location.url('/');
					};
					apply();
				};

				var unwatchSocket = clStateMgr.state && scope.$watch('socketSvc.isReady', function(isReady) {
					if (isReady) {
						unwatchSocket();
						if (clStateMgr.state) {
							var newUserToken = clStateMgr.state.$search.newUserToken;
							if (clStateMgr.state.$search.userToken) {
								clToast('Account is already in use.');
							} else if (newUserToken) {
								clSocketSvc.sendMsg({
									type: 'linkUser',
									token: newUserToken
								});
							}
						}
					}
				});

				/****
				Trash
				****/

				(function() {

					scope.getTrashFiles = function(reset) {
						if (scope.getTrashFilesPending) {
							return;
						}
						if (reset) {
							scope.trashFiles = [];
							scope.lastDeleted = undefined;
						}
						scope.getTrashFilesPending = scope.$watch('socketSvc.isReady', function(isReady) {
							if (isReady) {
								clSocketSvc.sendMsg({
									type: 'getTrashFiles',
									lastDeleted: scope.lastDeleted
								});
							}
						});
					};

					scope.recoverFile = function(file) {
						clSyncSvc.filesToRecover[file.id] = file;
						clToast('File recovery is pending...');
					};

					scope.removeFile = function(file) {
						$mdDialog.show($mdDialog.confirm()
								.title('Remove from trash')
								.content('This will remove the file permanently. Are you sure?')
								.ok('Yes')
								.cancel('No'))
							.then(function() {
								clSocketSvc.isReady && clSocketSvc.sendMsg({
									type: 'deleteFile',
									id: file.id
								});
								scope.trashFiles = scope.trashFiles.filter(function(deletedFile) {
									return deletedFile.id !== file.id;
								});
							});
					};

					function trashFilesHandler(msg) {
						if (scope.getTrashFilesPending) {
							scope.trashFiles = scope.trashFiles.concat(msg.files);
							scope.lastDeleted = msg.lastDeleted;
							scope.getTrashFilesPending();
							scope.getTrashFilesPending = undefined;
							scope.$evalAsync();
						}
					}
					clSocketSvc.addMsgHandler('trashFiles', trashFilesHandler);
					scope.$on('$destroy', function() {
						clSocketSvc.removeMsgHandler('trashFiles', trashFilesHandler);
					});

				})();

				scope.$watch('selectedTabIndex', function(newIndex, oldIndex) {
					next = undefined;
					oldIndex !== undefined && checkModifications(oldIndex);
					var tab = tabs[newIndex];
					if (tab === 'trash') {
						scope.getTrashFiles(true);
					}
					$location.search('tab', tab);
				});

				function applyLocationSearch() {
					scope.selectedTabIndex = tabs.indexOf($location.search().tab);
				}
				scope.$on('$locationChangeSuccess', applyLocationSearch);
				applyLocationSearch();
			}
		};
	});
