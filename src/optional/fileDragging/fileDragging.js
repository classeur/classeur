angular.module('classeur.optional.fileDragging', [])
	.directive('clFileDraggingSrc',
		function($window, clFileDraggingSvc, clExplorerLayoutSvc) {
			var Hammer = $window.Hammer;
			var bodyElt = angular.element($window.document.body);
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				function movePanel(evt) {
					evt.preventDefault();
					clFileDraggingSvc.panelElt.clanim
						.translateX(evt.center.x + 10)
						.translateY(evt.center.y)
						.start();
				}
				var hammertime = new Hammer(element[0]);
				hammertime.get('pan').set({
					direction: Hammer.DIRECTION_ALL,
					threshold: 0
				});
				hammertime.on('panstart', function(evt) {
					clFileDraggingSvc.setTargetFolder();
					clFileDraggingSvc.setFileSrc(scope.fileDao);
					clFileDraggingSvc.panelElt.clanim
						.width(clExplorerLayoutSvc.explorerWidth - clExplorerLayoutSvc.scrollbarWidth - (clExplorerLayoutSvc.noPadding ? 90 : 215))
						.start();
					movePanel(evt);
					bodyElt.addClass('file dragging');
					scope.$apply();
				});
				hammertime.on('panmove', function(evt) {
					movePanel(evt);
				});
				hammertime.on('panend', function() {
					clFileDraggingSvc.moveFiles();
					clFileDraggingSvc.files = [];
					clFileDraggingSvc.setTargetFolder();
					bodyElt.removeClass('file dragging');
					scope.$apply();
				});
			}
		})
	.directive('clFileDraggingTarget',
		function(clFileDraggingSvc, clExplorerLayoutSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				if (scope.folderDao === clExplorerLayoutSvc.createFolder) {
					return;
				}
				element[0].addEventListener('mouseenter', function() {
					if (clFileDraggingSvc.files.length) {
						clFileDraggingSvc.setTargetFolder(scope.folderDao);
					}
				});
				element[0].addEventListener('mouseleave', function() {
					if (clFileDraggingSvc.targetFolder === scope.folderDao) {
						clFileDraggingSvc.setTargetFolder();
					}
				});
			}
		})
	.directive('clFileDragging',
		function(clFileDraggingSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/fileDragging/fileDragging.html',
				link: link
			};

			function link(scope, element) {
				scope.fileDraggingSvc = clFileDraggingSvc;
				clFileDraggingSvc.panelElt = element[0].querySelector('.panel');
			}
		})
	.factory('clFileDraggingSvc',
		function(clDialog, clExplorerLayoutSvc, clToast) {
			function setFileSrc(fileDao) {
				clFileDraggingSvc.files = fileDao.isSelected ? clExplorerLayoutSvc.files.cl_filter(function(fileDao) {
					return !fileDao.userId && fileDao.isSelected;
				}) : [fileDao];
			}

			function setTargetFolder(folderDao) {
				clFileDraggingSvc.targetFolder = folderDao;
			}

			function doMoveFiles(targetFolder, files) {
				var targetFolderId = targetFolder === clExplorerLayoutSvc.unclassifiedFolder ? '' : targetFolder.id;
				files = files.cl_filter(function(fileDao) {
					if (fileDao.folderId !== targetFolderId) {
						fileDao.folderId = targetFolderId;
						return true;
					}
				});
				if (files.length) {
					clExplorerLayoutSvc.refreshFiles();
					var msg = files.length;
					msg += msg > 1 ? ' files moved to ' : ' file moved to ';
					msg += targetFolder.name + '.';
					clToast(msg);
				}
			}

			function moveFiles() {
				if (clFileDraggingSvc.targetFolder && clFileDraggingSvc.targetFolder !== clExplorerLayoutSvc.currentFolderDao) {
					if (clFileDraggingSvc.targetFolder.userId) {
						if (clFileDraggingSvc.targetFolder.sharing === 'rw') {
							var title = 'Change ownership';
							var confirm = clDialog.confirm()
								.title(title)
								.ariaLabel(title)
								.content('You\'re about to change the ownership of your file(s). Are you sure?')
								.ok('Yes')
								.cancel('No');
							return clDialog.show(confirm).then(doMoveFiles.cl_bind(null, clFileDraggingSvc.targetFolder, clFileDraggingSvc.files));
						} else {
							return clToast('Cannot move files to read only folder.');
						}
					}
					doMoveFiles(clFileDraggingSvc.targetFolder, clFileDraggingSvc.files);
				}
			}

			var clFileDraggingSvc = {
				files: [],
				setFileSrc: setFileSrc,
				setTargetFolder: setTargetFolder,
				moveFiles: moveFiles
			};
			return clFileDraggingSvc;
		});
