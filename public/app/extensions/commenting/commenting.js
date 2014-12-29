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

				commenting.discussionsModelObject = {
					a: {
						start: 10,
						end: 20,
						comments: []
					},
				b: {
						start: 110,
					end: 120,
					comments: []
				},
					$users: {}
				};
				scope.$watch('commenting.lastDiscussionChange', function() {
					commenting.updateDiscussions(commenting.discussionsModelObject);
					debouncedRefreshCoordinates();
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
	.directive('clCommentInput', function(commenting, user, layout) {
		return {
			restrict: 'E',
			template: '<md-text-float label="Comment" ng-model="commenting.newCommentContent"></md-text-float>',
			link: function(scope, element) {
				var inputElt = element[0].querySelector('input');
				inputElt.addEventListener('mousedown', function(e) {
					e.stopPropagation();
				});
				inputElt.addEventListener('keydown', function(e) {
					// Check enter key
					if(e.which !== 13) {
						return;
					}
					e.preventDefault();
					var discussion = commenting.discussionsModelObject[commenting.currentDiscussion.id];
					if(discussion && commenting.newCommentContent) {
						discussion.comments.push({
							user: user.localId,
							content: commenting.newCommentContent
						});
						commenting.newCommentContent = undefined;
						layout.currentControl = undefined;
						commenting.discussionsModelObject.$users[user.localId] = user.name;
						commenting.lastDiscussionChange = Date.now();
						scope.$apply();
					}
				});
				setTimeout(function() {
					inputElt.focus();
				}, 100);
			}
		};
	})
	.factory('commenting', function(editor, layout, settings) {
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

		var Marker = window.cledit.Utils.Marker;
		function Discussion(id, modelObject, users) {
			this.id = id;
			this.startMarker = new Marker(modelObject.start);
			this.endMarker = new Marker(modelObject.end);
			this.comments = modelObject.comments.map(function(commentModelObject) {
				return {
					user: users[commentModelObject.user] || settings.values.defaultUserName,
					content: commentModelObject.content
				};
			});
			this.modelObject = modelObject;
			this.commentButton = new CommentButton();
		}

		var commenting = {
			updateDiscussions: updateDiscussions,
			refreshCoordinates: refreshCoordinates,
			select: select,
			highlight: highlight,
			undoHighlight: undoHighlight
		};

		function updateDiscussions(discussionsModelObject) {
			var discussions = [];
			Object.keys(discussionsModelObject).forEach(function(id) {
				id[0] !== '$' && discussions.push(new Discussion(id, discussionsModelObject[id], discussionsModelObject.$users || {}));
			});
			commenting.discussions = discussions;
		}

		function refreshCoordinates() {
			yList = [];
			commenting.discussions.sort(function(discussion1, discussion2) {
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

		return commenting;
	});
