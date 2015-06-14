angular.module('classeur.optional.commenting', [])
	.directive('clNewCommentButton',
		function($window, clEditorSvc, clEditorLayoutSvc, clPanel) {
			return {
				restrict: 'E',
				template: '<cl-button class="rotate-180 new-comment-btn" ng-click="addComment()"><a class="icon-insert-comment"></a></cl-button>',
				link: link
			};

			function link(scope, element) {
				var btnPanel = clPanel(element, '.btn-panel');
				var selectionStart, selectionEnd;

				var toggleButton = $window.cledit.Utils.debounce(function() {
					btnPanel.$jqElt.addClass('hide');
					if (clEditorSvc.cledit && clEditorSvc.cledit.selectionMgr.hasFocus) {
						selectionStart = clEditorSvc.cledit.selectionMgr.selectionStart;
						selectionEnd = clEditorSvc.cledit.selectionMgr.selectionEnd;
						var coordinates = clEditorSvc.cledit.selectionMgr.cursorCoordinates;
						if (selectionStart !== selectionEnd && coordinates.top !== undefined) {
							btnPanel.$jqElt.removeClass('hide');
							btnPanel.top(coordinates.top + coordinates.height);
							btnPanel.left(coordinates.left);
						}
					}
				}, 500);

				var unwatch = scope.$watch('editorSvc.cledit', function(cledit) {
					if (cledit) {
						unwatch();
						cledit.selectionMgr.on('selectionChanged', toggleButton);
						cledit.selectionMgr.on('cursorCoordinatesChanged', toggleButton);
						cledit.on('focus', toggleButton);
						cledit.on('blur', toggleButton);
					}
				});

				scope.addComment = function() {
					clEditorLayoutSvc.isSideBarOpen = true;
					clEditorLayoutSvc.sideBarTab = 'comments';
				};

				toggleButton();
			}
		});
