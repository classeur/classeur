angular.module('classeur.core.classeurLayout', [])
	.directive('clFolderButton', function(clClasseurLayoutSvc, clPanel) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var elt = element[0];
				var parentElt = elt.parentNode;
				var buttonPanel = clPanel(element);
				var duration = 0;
				var isSelected;

				function animate() {
					element.toggleClass('selected', isSelected);
					var y = (clClasseurLayoutSvc.folders.length - scope.$index - 1) * 109;
					buttonPanel.move().translate(isSelected ? 0 : -4, y).duration(duration).ease('out').end();
					duration = 90;
					if(isSelected) {
						// Adjust scrolling position
						var minY = parentElt.scrollTop + 30;
						var maxY = parentElt.scrollTop + parentElt.clientHeight - 330;
						if(y > maxY) {
							parentElt.scrollTop += y - maxY;
						}
						if(y < minY) {
							parentElt.scrollTop += y - minY;
						}
					}
				}

				scope.$watch('classeurLayoutSvc.folders.length - $index', animate);
				scope.$watch('classeurLayoutSvc.currentFolder === folderDao || folderDao.isDraggingTarget', function(isEqual) {
					isSelected = isEqual;
					animate();
				});
			}
		};
	})
	.directive('clFileEntry', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/fileEntry.html'
		};
	})
	.directive('clClasseurLayout', function($mdDialog, clClasseurLayoutSvc, clDocFileSvc, clFileSvc, clFolderSvc, clUid, clPanel) {
		var classeurMaxWidth = 680;
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/classeurLayout.html',
			link: function(scope, element) {
				document.title = 'Classeur';

				var classeurPanel = clPanel(element, '.classeur.container');

				function animateLayout() {
					var classeurWidth = document.body.clientWidth;
					if(classeurWidth > classeurMaxWidth) {
						classeurWidth = classeurMaxWidth;
					}
					classeurPanel.width(classeurWidth).move().x(-classeurWidth / 2 - 44).end();
				}

				animateLayout();

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				function folderTitleFocus() {
					setTimeout(function() {
						var input = element[0].querySelector('.folder.title');
						input && input.setSelectionRange(0, input.value.length);
					}, 10);
				}

				function setPlasticClass() {
					scope.plasticClass = 'plastic';
					if(clClasseurLayoutSvc.currentFolder) {
						var index = clClasseurLayoutSvc.folders.indexOf(clClasseurLayoutSvc.currentFolder);
						scope.plasticClass = 'plastic-' + ((clClasseurLayoutSvc.folders.length - index) % 4);
					}
				}

				scope.folderTitleModified = function() {
					clClasseurLayoutSvc.currentFolder.name = clClasseurLayoutSvc.currentFolder.name || 'Untitled';
					clClasseurLayoutSvc.refreshFolders();
					setPlasticClass();
				};

				scope.setFolder = function(folder) {
					if(folder === clClasseurLayoutSvc.createFolder) {
						var newFolder = clFolderSvc.createFolder('New folder');
						clClasseurLayoutSvc.refreshFolders();
						scope.setFolder(newFolder);
						return folderTitleFocus();
					}
					folder = folder === clClasseurLayoutSvc.unclassifiedFolder ? folder : (folder && clFolderSvc.folderMap[folder.id]);
					clClasseurLayoutSvc.currentFolder = folder;
				};
				scope.setFolder(clClasseurLayoutSvc.currentFolder);

				scope.selectAll = function() {
					clClasseurLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = true;
					});
				};

				scope.selectNone = function() {
					clClasseurLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = false;
					});
				};

				scope.hasSelection = function() {
					return clClasseurLayoutSvc.files.some(function(fileDao) {
						return fileDao.isSelected;
					});
				};

				scope.deleteConfirm = function(deleteFolder) {
					deleteFolder && scope.selectAll();
					var filesToRemove = clClasseurLayoutSvc.files.filter(function(fileDao) {
						return fileDao.isSelected;
					});
					function remove() {
						clFileSvc.removeLocalFiles(filesToRemove);
						if(deleteFolder && clFolderSvc.removeFolder(clClasseurLayoutSvc.currentFolder) >= 0) {
							var newIndex = clClasseurLayoutSvc.folders.indexOf(clClasseurLayoutSvc.currentFolder) + 1;
							var currentFolder = clClasseurLayoutSvc.folders[newIndex] || clClasseurLayoutSvc.unclassifiedFolder;
							scope.setFolder(currentFolder);
						}
					}
					if(!filesToRemove.length) {
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

				scope.$watch('classeurLayoutSvc.currentFolder', function() {
					clClasseurLayoutSvc.refreshFiles();
					scope.selectNone();
					setPlasticClass();
				});

				scope.$watch('fileSvc.localFiles', clClasseurLayoutSvc.refreshFiles);
				scope.$watch('folderSvc.folders', clClasseurLayoutSvc.refreshFolders);

				scope.loadDocFile = function(fileName, fileTitle) {
					scope.setFileDao(clDocFileSvc(fileName, fileTitle));
				};
				scope.loadFile = function(fileDao) {
					fileDao.load(function() {
						scope.setFileDao(fileDao);
					});
				};
				scope.newFile = function() {
					var fileDao = clFileSvc.createLocalFile();
					if(clClasseurLayoutSvc.currentFolder) {
						fileDao.folderId = clClasseurLayoutSvc.currentFolder.id;
					}
					scope.loadFile(fileDao);
					clClasseurLayoutSvc.refreshFiles();
				};
			}
		};
	})
	.factory('clClasseurLayoutSvc', function(clFolderSvc, clFileSvc) {
		var createFolder = {
			name: 'Create folder'
		};
		var unclassifiedFolder = {
			name: 'Unclassified'
		};

		function refreshFolders() {
			clClasseurLayoutSvc.folders = clFolderSvc.folders.slice().sort(function(folder1, folder2) {
				return folder1.name.toLowerCase() < folder2.name.toLowerCase();
			});
			clClasseurLayoutSvc.folders.unshift(createFolder);
			clClasseurLayoutSvc.folders.push(unclassifiedFolder);
			if(clClasseurLayoutSvc.currentFolder && clClasseurLayoutSvc.currentFolder !== unclassifiedFolder) {
				// Make sure current folder still exists
				clClasseurLayoutSvc.currentFolder = clFolderSvc.folderMap[clClasseurLayoutSvc.currentFolder.id];
			}
		}

		function refreshFiles() {
			clClasseurLayoutSvc.files = clClasseurLayoutSvc.currentFolder ? clFileSvc.localFiles.filter(
				clClasseurLayoutSvc.currentFolder === unclassifiedFolder ? function(fileDao) {
					return !clFolderSvc.folderMap.hasOwnProperty(fileDao.folderId);
				} : function(fileDao) {
					return fileDao.folderId === clClasseurLayoutSvc.currentFolder.id;
				}) : clFileSvc.localFiles.slice();
			clClasseurLayoutSvc.files.sort(
				clClasseurLayoutSvc.currentFolder ? function(fileDao1, fileDao2) {
					return fileDao1.title > fileDao2.title;
				} : function(fileDao1, fileDao2) {
					return fileDao1.updated < fileDao2.updated;
				});
		}

		var clClasseurLayoutSvc = {
			folders: [],
			files: [],
			createFolder: createFolder,
			unclassifiedFolder: unclassifiedFolder,
			refreshFolders: refreshFolders,
			refreshFiles: refreshFiles
		};

		return clClasseurLayoutSvc;
	});
