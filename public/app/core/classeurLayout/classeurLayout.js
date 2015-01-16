angular.module('classeur.core.classeurLayout', [])
	.directive('clFolderButton', function(clPanel) {
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
					var y = (scope.folders.length - scope.$index - 1) * 108;
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

				scope.$watch('folders', animate);
				scope.$watch('currentFolder === folder', function(isEqual) {
					isSelected = isEqual;
					animate();
				});
			}
		};
	})
	.directive('clClasseurLayout', function(clDocFileSvc, clFileSvc, clFolderSvc, clUid, clPanel) {
		var classeurMaxWidth = 650;
		return {
			restrict: 'E',
			templateUrl: 'app/core/classeurLayout/classeurLayout.html',
			link: function(scope, element) {
				document.title = 'Classeur';

				var classeurPanel = clPanel(element, '.classeur.panel');

				function animateLayout() {
					var classeurWidth = document.body.clientWidth;
					if(classeurWidth > classeurMaxWidth) {
						classeurWidth = classeurMaxWidth;
					}
					classeurPanel.width(classeurWidth).move().x(-classeurWidth / 2 - 50).end();
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

				clFolderSvc.Folder.prototype.folderTitleModified = function() {
					this.name = this.name || 'Untitled';
					this.save();
					refreshFolders();
					setPlasticClass();
				};

				var createFolder = {
					name: 'Create folder'
				};
				var unclassifiedFolder = {
					id: '',
					name: 'Unclassified'
				};
				scope.createFolder = createFolder;
				scope.unclassifiedFolder = unclassifiedFolder;

				function refreshFolders() {
					clFolderSvc.folders.sort(function(folder1, folder2) {
						return folder1.name.toLowerCase() < folder2.name.toLowerCase();
					});
					scope.folders = clFolderSvc.folders.slice();
					scope.folders.unshift(createFolder);
					scope.folders.push(unclassifiedFolder);
				}

				function refreshFiles() {
					scope.files = scope.currentFolder ? clFileSvc.localFiles.filter(function(fileDao) {
						return fileDao.folderId === scope.currentFolder.id;
					}) : clFileSvc.localFiles.slice();
				}

				function setPlasticClass() {
					scope.plasticClass = 'plastic';
					if(scope.currentFolder) {
						var index = scope.folders.indexOf(scope.currentFolder);
						scope.plasticClass = 'plastic-' + ((scope.folders.length - index) % 4);
					}
				}

				refreshFolders();

				scope.setFolder = function(folder) {
					if(folder === createFolder) {
						var newFolder = clFolderSvc.newFolder('New folder');
						refreshFolders();
						scope.setFolder(newFolder);
						return folderTitleFocus();
					}
					scope.currentFolder = folder;
					refreshFiles();
					setPlasticClass();
				};
				scope.setFolder();

				scope.loadDocFile = function(fileName, fileTitle) {
					scope.setFileDao(clDocFileSvc(fileName, fileTitle));
				};
				scope.loadFile = function(fileDao) {
					fileDao.load(function() {
						scope.setFileDao(fileDao);
					});
				};
				scope.newFile = function() {
					var fileDao = clFileSvc.newLocalFile();
					if(scope.currentFolder) {
						fileDao.folderId = scope.currentFolder.id;
					}
					scope.loadFile(fileDao);
					refreshFiles();
				};
			}
		};
	});
