angular.module('classeur.core.explorerLayout', [])
	.directive('clFolderButton', function(clExplorerLayoutSvc, clPanel) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var elt = element[0];
				var parentElt = elt.parentNode;
				var buttonPanel = clPanel(element);
				var duration = 0;
				var isOpen;

				function animate() {
					element.toggleClass('open', isOpen);
					var y = scope.$index * 109;
					var z = isOpen ? 10000 : (scope.folderDao ? scope.explorerLayoutSvc.folders.length - scope.$index : 9998);
					buttonPanel.css('z-index', z).$$elt.offsetWidth; // Force z-offset to refresh before the animation
					buttonPanel.move().translate(isOpen ? 0 : -4, y).duration(duration).ease('out').end();
					duration = 90;
					if (isOpen) {
						// Adjust scrolling position
						var minY = parentElt.scrollTop + 30;
						var maxY = parentElt.scrollTop + parentElt.clientHeight - 330;
						if (y > maxY) {
							parentElt.scrollTop += y - maxY;
						}
						if (y < minY) {
							parentElt.scrollTop += y - minY;
						}
					}
				}

				scope.$watch('$index', animate);
				scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao || folderDao.isDraggingTarget', function(isEqual) {
					isOpen = isEqual;
					animate();
				});
			}
		};
	})
	.directive('clFileEntry', function() {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/fileEntry.html'
		};
	})
	.directive('clExplorerLayout', function($window, $mdDialog, clExplorerLayoutSvc, clDocFileSvc, clFileSvc, clFolderSvc, clUid, clPanel, clConstants, clStateMgr) {
		var explorerMaxWidth = 720;
		var noPaddingWidth = 560;
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/explorerLayout.html',
			link: function(scope, element) {
				document.title = 'Classeur';

				var explorerPanel = clPanel(element, '.explorer.container');
				var folderContainerPanel = clPanel(element, '.folder.container');

				function animateLayout() {
					clExplorerLayoutSvc.explorerWidth = document.body.clientWidth;
					var containerPadding = 12;
					var noPadding = true;
					if (clExplorerLayoutSvc.explorerWidth > noPaddingWidth) {
						containerPadding = 50;
						noPadding = false;
					}
					if (clExplorerLayoutSvc.explorerWidth > explorerMaxWidth) {
						clExplorerLayoutSvc.explorerWidth = explorerMaxWidth;
					}
					clExplorerLayoutSvc.folderContainerWidth = clExplorerLayoutSvc.explorerWidth - containerPadding * 2 - 35;
					explorerPanel.width(clExplorerLayoutSvc.explorerWidth).move().x(-clExplorerLayoutSvc.explorerWidth / 2 - 44).end();
					folderContainerPanel.width(clExplorerLayoutSvc.folderContainerWidth).marginLeft(containerPadding).$elt.toggleClass('no-padding', noPadding);
				}

				animateLayout();

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				function folderNameFocus() {
					setTimeout(function() {
						var input = element[0].querySelector('.folder.name');
						input && input.setSelectionRange(0, input.value.length);
					}, 10);
				}

				function setPlasticClass() {
					scope.plasticClass = 'plastic';
					if (clExplorerLayoutSvc.currentFolderDao) {
						var index = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao);
						scope.plasticClass = 'plastic-' + ((index + 1) % 4);
					}
				}

				scope.folderNameModified = function() {
					clExplorerLayoutSvc.currentFolderDao.name = clExplorerLayoutSvc.currentFolderDao.name || 'Untitled';
					clExplorerLayoutSvc.refreshFolders();
					setPlasticClass();
				};

				scope.setFolder = function(folder) {
					if (folder === clExplorerLayoutSvc.createFolder) {
						var newFolder = clFolderSvc.createFolder();
						newFolder.name = 'New folder';
						clExplorerLayoutSvc.refreshFolders();
						clExplorerLayoutSvc.setCurrentFolder(newFolder);
						return folderNameFocus();
					}
					clExplorerLayoutSvc.setCurrentFolder(folder);
				};

				scope.selectAll = function() {
					clExplorerLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = true;
					});
				};

				scope.selectNone = function() {
					clExplorerLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = false;
					});
				};

				scope.hasSelection = function() {
					return clExplorerLayoutSvc.files.some(function(fileDao) {
						return fileDao.isSelected;
					});
				};

				scope.deleteConfirm = function(deleteFolder) {
					deleteFolder && scope.selectAll();
					var filesToRemove = clExplorerLayoutSvc.files.filter(function(fileDao) {
						return fileDao.isSelected;
					});

					function remove() {
						clFileSvc.removeFiles(filesToRemove);
						if (deleteFolder && clFolderSvc.removeFolder(clExplorerLayoutSvc.currentFolderDao) >= 0) {
							var newIndex = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) - 1;
							var currentFolderDao = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder;
							clExplorerLayoutSvc.setCurrentFolder(currentFolderDao);
						}
					}
					if (!filesToRemove.length) {
						return remove();
					}
					var title = deleteFolder ? 'Delete folder' : 'Delete files';
					var confirm = $mdDialog.confirm()
						.title(title)
						.ariaLabel(title)
						.content('You\'re about to delete ' + filesToRemove.length + ' file(s). Are you sure?')
						.ok('Delete')
						.cancel('Cancel');
					$mdDialog.show(confirm).then(remove);
				};

				scope.signin = function() {
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
				};

				scope.$watch('explorerLayoutSvc.currentFolderDao', function() {
					clExplorerLayoutSvc.refreshFiles();
					scope.selectNone();
					setPlasticClass();
				});

				scope.$watch('fileSvc.files', clExplorerLayoutSvc.refreshFiles);
				scope.$watch('folderSvc.folders', clExplorerLayoutSvc.refreshFolders);

				scope.newFile = function() {
					var fileDao = clFileSvc.createFile();
					if (clExplorerLayoutSvc.currentFolderDao) {
						fileDao.folderId = clExplorerLayoutSvc.currentFolderDao.id;
					}
					scope.setCurrentFile(fileDao);
					clExplorerLayoutSvc.refreshFiles();
				};
			}
		};
	})
	.factory('clExplorerLayoutSvc', function(clFolderSvc, clFileSvc) {
		var unclassifiedFolder = {
			name: 'Unclassified'
		};
		var createFolder = {
			name: 'Create folder'
		};
		var isInited;

		function refreshFolders() {
			clExplorerLayoutSvc.folders = clFolderSvc.folders.slice().sort(function(folder1, folder2) {
				return folder1.name.toLowerCase() > folder2.name.toLowerCase();
			});
			clExplorerLayoutSvc.folders.unshift(unclassifiedFolder);
			clExplorerLayoutSvc.folders.push(createFolder);
			setCurrentFolder(isInited ? clExplorerLayoutSvc.currentFolderDao : clFolderSvc.folderMap[localStorage[lastFolderKey]]);
			isInited = true;
		}

		function refreshFiles() {
			clExplorerLayoutSvc.files = clExplorerLayoutSvc.currentFolderDao ? clFileSvc.files.filter(
				clExplorerLayoutSvc.currentFolderDao === unclassifiedFolder ? function(fileDao) {
					return !clFolderSvc.folderMap.hasOwnProperty(fileDao.folderId);
				} : function(fileDao) {
					return fileDao.folderId === clExplorerLayoutSvc.currentFolderDao.id;
				}) : clFileSvc.localFiles.slice();
			clExplorerLayoutSvc.files.sort(
				clExplorerLayoutSvc.currentFolderDao ? function(fileDao1, fileDao2) {
					return fileDao1.name > fileDao2.name;
				} : function(fileDao1, fileDao2) {
					return fileDao1.updated < fileDao2.updated;
				});
		}

		var lastFolderKey = 'lastFolderId';

		function setCurrentFolder(folder) {
			folder = folder === unclassifiedFolder ? folder : (folder && clFolderSvc.folderMap[folder.id]);
			clExplorerLayoutSvc.currentFolderDao = folder;
			(folder && folder.id) ? localStorage.setItem(lastFolderKey, folder.id): localStorage.removeItem(lastFolderKey);
		}

		var clExplorerLayoutSvc = {
			folders: [],
			files: [],
			unclassifiedFolder: unclassifiedFolder,
			createFolder: createFolder,
			refreshFolders: refreshFolders,
			refreshFiles: refreshFiles,
			setCurrentFolder: setCurrentFolder
		};

		return clExplorerLayoutSvc;
	});
