angular.module('classeur.opt.fileDragging', [])
	.directive('clFileDraggingSrc', function(clFileDraggingSvc, clExplorerLayoutSvc) {
		var Hammer = window.Hammer;
		return {
			restrict: 'A',
			link: function(scope, element) {
				function movePanel(evt) {
					evt.preventDefault();
					clFileDraggingSvc.panel.move().to(evt.center.x + 10, evt.center.y).end();
				}
				var hammertime = new Hammer(element[0]);
				hammertime.get('pan').set({
					direction: Hammer.DIRECTION_ALL,
					threshold: 0
				});
				hammertime.on('panstart', function(evt) {
					clFileDraggingSvc.setFolderTarget();
					clFileDraggingSvc.setFileSrc(scope.fileDao);
					clFileDraggingSvc.panel.width(clExplorerLayoutSvc.folderContainerWidth);
					movePanel(evt);
					scope.$apply();
				});
				hammertime.on('panmove', function(evt) {
					movePanel(evt);
				});
				hammertime.on('panend', function() {
					clFileDraggingSvc.moveFiles();
					clFileDraggingSvc.files = [];
					clFileDraggingSvc.setFolderTarget();
					scope.$apply();
				});
			}
		};
	})
	.directive('clFileDraggingTarget', function(clFileDraggingSvc, clExplorerLayoutSvc) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				if (scope.folderDao === clExplorerLayoutSvc.createFolder) {
					return;
				}
				element.on('mouseenter', function() {
					if (clFileDraggingSvc.files.length) {
						clFileDraggingSvc.setFolderTarget(scope.folderDao);
						scope.$apply();
					}
				});
				element.on('mouseleave', function() {
					if (clFileDraggingSvc.targetFolder === scope.folderDao) {
						clFileDraggingSvc.setFolderTarget();
						scope.$apply();
					}
				});
			}
		};
	})
	.directive('clFileDragging', function(clFileDraggingSvc, clPanel) {
		return {
			restrict: 'E',
			templateUrl: 'opt/fileDragging/fileDragging.html',
			link: function(scope, element) {
				scope.fileDraggingSvc = clFileDraggingSvc;
				clFileDraggingSvc.panel = clPanel(element, '.panel');
			}
		};
	})
	.factory('clFileDraggingSvc', function(clExplorerLayoutSvc, clToast) {
		function setFileSrc(fileDao) {
			clFileDraggingSvc.files = fileDao.isSelected ? clExplorerLayoutSvc.files.filter(function(fileDao) {
				return !fileDao.userId && fileDao.isSelected;
			}) : [fileDao];
		}

		function setFolderTarget(folderDao) {
			if (clFileDraggingSvc.targetFolder) {
				clFileDraggingSvc.targetFolder.isDraggingTarget = false;
				clFileDraggingSvc.targetFolder = undefined;
			}
			if (folderDao) {
				folderDao.isDraggingTarget = true;
				clFileDraggingSvc.targetFolder = folderDao;
			}
		}

		function moveFiles() {
			if (clFileDraggingSvc.targetFolder && clFileDraggingSvc.targetFolder !== clExplorerLayoutSvc.currentFolderDao) {
				if(clFileDraggingSvc.targetFolder.userId) {
					return clToast('Unable to move files to public folder.');
				}
				clFileDraggingSvc.files.forEach(function(fileDao) {
					fileDao.folderId = clFileDraggingSvc.targetFolder.id;
				});
				clExplorerLayoutSvc.refreshFiles();
			}
		}

		var clFileDraggingSvc = {
			files: [],
			setFileSrc: setFileSrc,
			setFolderTarget: setFolderTarget,
			moveFiles: moveFiles
		};
		return clFileDraggingSvc;
	});
