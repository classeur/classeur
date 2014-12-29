angular.module('classeur.extensions.commenting', [])
	.directive('clCommentingGutter', function($timeout, commenting) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/commentingGutter.html',
			scope: true,
			link: function(scope) {
				scope.commenting = commenting;
				scope.setCurrentDiscussion = function(discussion) {
					// Select modifies editor selection provoking comment dismiss
					commenting.select(discussion);
					$timeout(function() {
						// Need to delay this as it's not refreshed properly
						commenting.highlight();
					}, 180);
				};

				var debouncedRefreshCoordinates = window.cledit.Utils.debounce(function() {
					commenting.refreshCoordinates();
					scope.$apply();
				}, 10);

				scope.$watch('editor.editorSize()', debouncedRefreshCoordinates);
				scope.$watch('editor.sectionList', debouncedRefreshCoordinates);
				scope.$watch('layout.currentControl', function(currentControl) {
					if(currentControl !== 'discussion') {
						commenting.currentDiscussion = undefined;
						commenting.undoHighlight();
					}
				});
			}
		};
	})
	.directive('clDiscussion', function($famous, commenting) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/discussion.html',
			scope: true,
			link: function(scope) {
				var EventHandler = $famous['famous/core/EventHandler'];
				scope.commenting = commenting;
				scope.draggableHandler = new EventHandler();
			}
		};
	})
	.directive('clCommentInput', function() {
		return {
			restrict: 'E',
			template: '<md-text-float label="Comment" ng-model="newComment"> </md-text-float>',
			link: function(scope, element) {
				var inputElt = element[0].querySelector('input');
				inputElt.addEventListener('mousedown', function(e) {
					e.stopPropagation();
				});
				scope.$watch('commenting.currentDiscussion', function() {
					setTimeout(function() {
						inputElt.focus();
					}, 100);
				});
			}
		};
	})
	.factory('commenting', function(editor, layout) {
		var commentButtonHeight = 30;

		function CommentButton() {
			this.setTop(-commentButtonHeight);
		}

		var yList = [];

		CommentButton.prototype.setTop = function(top, isNew) {
			top = Math.round(top);
			var yListIndex = top - commentButtonHeight + 1;
			// Avoid overlap of comment icons
			while(yListIndex < top + commentButtonHeight) {
				if(yList[yListIndex]) {
					top = yListIndex + commentButtonHeight;
				}
				yListIndex++;
			}
			!isNew && (yList[top] = 1);
			this.top = (top - commentButtonHeight/2 + 1) + 'px';
		};

		function Discussion(startMarker, endMarker, comments) {
			this.startMarker = startMarker;
			this.endMarker = endMarker;
			this.comments = comments;
			this.commentButton = new CommentButton();
		}

		var Marker = window.cledit.Utils.Marker;
		var discussions = [
			new Discussion(new Marker(10), new Marker(20), []),
			new Discussion(new Marker(110), new Marker(120), []),
			new Discussion(new Marker(110), new Marker(120), []),
		];
		function refreshCoordinates() {
			yList = [];
			discussions.sort(function(discussion1, discussion2) {
				return discussion1.endMarker.offset - discussion2.endMarker.offset;
			}).forEach(function(discussion) {
				var coordinates = editor.cledit.selectionMgr.getCoordinates(discussion.endMarker.offset);
				discussion.commentButton.setTop(coordinates.y);
			});
		}

		var classApplier = window.rangy.createClassApplier('discussion-highlight', {
			normalize: false
		});
		var selectionRange, selectedDiscussion;
		function select(discussion) {
			undoHighlight();
			selectedDiscussion = discussion;

			// Select text in the editor
			var range = editor.cledit.selectionMgr.setSelectionStartEnd(discussion.startMarker.offset, discussion.endMarker.offset);
			// Create rangy range
			selectionRange = window.rangy.createRange();
			selectionRange.setStart(range.startContainer, range.startOffset);
			selectionRange.setEnd(range.endContainer, range.endOffset);
		}
		function highlight() {
			this.currentDiscussion = selectedDiscussion;
			layout.currentControl = 'discussion';
			classApplier.applyToRange(selectionRange);
		}
		function undoHighlight() {
			try {
				classApplier.undoToRange(selectionRange);
			}
			catch(e) {}
		}

		return {
			discussions: discussions,
			refreshCoordinates: refreshCoordinates,
			select: select,
			highlight: highlight,
			undoHighlight: undoHighlight
		};
	});
