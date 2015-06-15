angular.module('classeur.optional.discussions', [])
	.directive('clDiscussionDecorator',
		function($window, $timeout, clUid, clEditorSvc, clEditorLayoutSvc, clPanel, clDiscussionSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/discussionDecorator.html',
				link: link
			};

			function link(scope) {
				var selectionStart, selectionEnd;

				var toggleButton = $window.cledit.Utils.debounce(function() {
					scope.show = false;
					if (clEditorSvc.cledit && clEditorSvc.cledit.selectionMgr.hasFocus) {
						selectionStart = clEditorSvc.cledit.selectionMgr.selectionStart;
						selectionEnd = clEditorSvc.cledit.selectionMgr.selectionEnd;
						scope.coordinates = clEditorSvc.cledit.selectionMgr.cursorCoordinates;
						if (selectionStart !== selectionEnd && scope.coordinates.top !== undefined) {
							$timeout(function() {
								scope.show = true;
							});
						}
					}
					scope.$apply();
				}, 500);
				toggleButton();

				var unwatch = scope.$watch('editorSvc.cledit', function(cledit) {
					if (cledit) {
						unwatch();
						cledit.selectionMgr.on('selectionChanged', toggleButton);
						cledit.selectionMgr.on('cursorCoordinatesChanged', toggleButton);
						cledit.on('focus', toggleButton);
						cledit.on('blur', toggleButton);
					}
				});

				scope.discussionSvc = clDiscussionSvc;
				scope.discussion = {};
				scope.createDiscussion = function() {
					scope.discussion = {
						id: clUid(),
						selectionStart: selectionStart,
						selectionEnd: selectionEnd,
					};
					// Force recreating the highlighter
					$timeout(function() {
						clEditorLayoutSvc.isSideBarOpen = true;
						clEditorLayoutSvc.sideBarTab = 'comments';
						clDiscussionSvc.currentDiscussion = scope.discussion;
					});
				};
			}
		})
	.directive('clDiscussionHighlighter',
		function($window, clEditorSvc, clEditorClassApplier) {
			var Marker = $window.cledit.Marker;

			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				var startMarker = new Marker(scope.discussion.selectionStart);
				var endMarker = new Marker(scope.discussion.selectionEnd);
				clEditorSvc.cledit.addMarker(startMarker);
				clEditorSvc.cledit.addMarker(endMarker);
				var classApplier = clEditorClassApplier(['discussion-highlighting-' + scope.discussion.id, 'discussion-highlighting'], function() {
					return {
						start: startMarker.offset,
						end: endMarker.offset
					};
				});

				scope.$on('$destroy', function() {
					startMarker && clEditorSvc.cledit.removeMarker(startMarker);
					endMarker && clEditorSvc.cledit.removeMarker(endMarker);
					classApplier && classApplier.stop();
				});
			}
		})
	.factory('clDiscussionSvc',
		function() {
			return {};
		});
