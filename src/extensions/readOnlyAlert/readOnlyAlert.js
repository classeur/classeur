angular.module('classeur.extensions.readOnlyAlert', [])
	.directive('clReadOnlyAlert', function(clEditorLayoutSvc, clFileSvc, clToast) {
		return {
			restrict: 'E',
			scope: true,
			template: '<cl-read-only-alert-panel ng-if="editorLayoutSvc.currentControl === \'readOnlyAlert\'"></cl-read-only-alert-panel>',
			link: function(scope) {
				if(!scope.currentFileDao.isReadOnly) {
					return;
				}

				var content = scope.currentFileDao.content;
				var wasDismissed;

				scope.dismiss = function() {
					wasDismissed = true;
					clEditorLayoutSvc.currentControl = undefined;
				};

				scope.$watch('currentFileDao.contentDao.content', function(newContent) {
					if(!wasDismissed && newContent !== content) {
						clEditorLayoutSvc.currentControl = 'readOnlyAlert';
					}
				});
			}
		};

	})
	.directive('clReadOnlyAlertPanel', function(clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'extensions/readOnlyAlert/readOnlyAlertPanel.html',
			link: function(scope, element) {
				clDraggablePanel(element, '.read-only-alert.panel', 0, 0, -1.5);
			}
		};

	});
