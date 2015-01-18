angular.module('classeur.extensions.readOnlyAlert', [])
	.directive('clReadOnlyAlert', function($timeout, clDraggablePanel, clEditorLayoutSvc, clFileSvc) {
		return {
			restrict: 'E',
			scope: true,
			templateUrl: 'app/extensions/readOnlyAlert/readOnlyAlert.html',
			link: function(scope, element) {
				if(!scope.fileDao.isReadOnly) {
					return;
				}
				clDraggablePanel(element, '.read-only-alert.panel', 0, 0, -1.5);

				var content = scope.fileDao.content;
				var wasDismissed;

				scope.dismiss = function() {
					wasDismissed = true;
					clEditorLayoutSvc.currentControl = undefined;
				};

				scope.createCopy = function() {
					var oldFileDao = scope.fileDao;
					var newFileDao = clFileSvc.createLocalFile();
					// Unload the editor
					scope.setFileDao();
					newFileDao.load(function() {
						['title', 'content', 'state', 'users', 'discussions'].forEach(function(attrName) {
							newFileDao[attrName] = oldFileDao[attrName];
						});
						scope.setFileDao(newFileDao);
					});
				};

				scope.$watch('fileDao.content', function(newContent) {
					if(!wasDismissed && newContent !== content) {
						clEditorLayoutSvc.currentControl = 'readOnlyAlert';
					}
				});
			}
		};

	});
