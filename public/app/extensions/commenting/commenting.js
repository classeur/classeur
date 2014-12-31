angular.module('classeur.extensions.commenting', [])
	.directive('clCommentingGutter', function($timeout, commenting) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/commentingGutter.html',
			scope: true,
			link: function(scope) {
				scope.commenting = commenting;

				scope.setCurrentDiscussion = function(discussion) {
					// Select modifies editor selection which provokes comment dismiss
					commenting.select(discussion);
					$timeout(function() {
						// Need to delay this as it's not refreshed properly
						commenting.highlight();
					}, 180);
				};

				var debouncedRefreshCoordinates = window.cledit.Utils.debounce(function() {
					commenting.refreshCoordinates();
					scope.$apply();
				}, 5);

				scope.$watch('editor.editorSize()', debouncedRefreshCoordinates);
				scope.$watch('editor.sectionList', debouncedRefreshCoordinates);
				scope.$watch('layout.currentControl', function(currentControl) {
					if(currentControl !== 'discussion') {
						commenting.currentDiscussion = undefined;
						commenting.undoHighlight();
					}
				});

				commenting.fileDao = {
					users: {},
					discussions: {
						a: {
							id: 'a',
							start: 10,
							end: 20,
							comments: []
						},
						b: {
							id: 'b',
							start: 110,
							end: 120,
							comments: []
						}
					}
				};
				scope.$watch('onDiscussionChanged', function() {
					commenting.updateDiscussions();
					debouncedRefreshCoordinates();
				});
				scope.$watch('onDiscussionOffsetChanged', function() {
					commenting.updateMarkers();
					debouncedRefreshCoordinates();
				});
			}
		};
	})
	.directive('clDiscussionButton', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/discussionButton.html',
			link: function(scope) {
				var discussion = scope.discussion;
				scope.$watchGroup(['discussion.startMarker.offset', 'discussion.endMarker.offset'], function() {
					discussion.discussionDao.start = discussion.startMarker.offset;
					discussion.discussionDao.end = discussion.endMarker.offset;
					scope.trigger('onDiscussionOffsetChanged');
				});
			}
		};
	})
	.directive('clDiscussion', function($famous, commenting, layout) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/discussion.html',
			scope: true,
			link: function(scope) {
				var EventHandler = $famous['famous/core/EventHandler'];
				scope.draggableHandler = new EventHandler();
				scope.commenting = commenting;
				scope.removeDiscussion = function(discussion) {
					layout.currentControl = undefined;
					delete commenting.fileDao.discussions[discussion.discussionDao.id];
					scope.trigger('onDiscussionChanged');
				};
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
					var discussionDao = commenting.currentDiscussion.discussionDao;
					if(discussionDao && commenting.newCommentContent) {
						discussionDao.comments.push({
							user: user.localId,
							content: commenting.newCommentContent
						});
						commenting.newCommentContent = undefined;
						layout.currentControl = undefined;
						commenting.fileDao.users[user.localId] = user.name;
						scope.trigger('onDiscussionChanged');
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
		var yList = [];

		var commenting = {
			discussions: [],
			updateDiscussions: updateDiscussions,
			updateMarkers: updateMarkers,
			refreshCoordinates: refreshCoordinates,
			select: select,
			highlight: highlight,
			undoHighlight: undoHighlight
		};

		var Marker = window.cledit.Marker;

		function Discussion(discussionDao, fileDao) {
			this.discussionDao = discussionDao;
			this.fileDao = fileDao;
			this.startMarker = new Marker(discussionDao.start);
			this.endMarker = new Marker(discussionDao.end);
			this.comments = discussionDao.comments.map(function(commentModelObject) {
				return {
					user: fileDao.users[commentModelObject.user] || settings.values.defaultUserName,
					content: commentModelObject.content
				};
			});
		}

		Discussion.prototype.setTopOffset = function(y, isNew) {
			y = Math.round(y);
			var yListIndex = y - commentButtonHeight + 1;
			// Avoid overlap of comment icons
			while(yListIndex < y + commentButtonHeight) {
				if(yList[yListIndex]) {
					y = yListIndex + commentButtonHeight;
				}
				yListIndex++;
			}
			!isNew && (yList[y] = 1);
			this.topOffset = (y - commentButtonHeight / 2 + 1) + 'px';
		};

		function updateDiscussions() {
			commenting.discussions.forEach(function(discussion) {
				editor.cledit.removeMarker(discussion.startMarker);
				editor.cledit.removeMarker(discussion.endMarker);
			});
			commenting.discussions = [];
			angular.forEach(commenting.fileDao.discussions, function(discussionDao) {
				var discussion = new Discussion(discussionDao, commenting.fileDao);
				commenting.discussions.push(discussion);
				editor.cledit.addMarker(discussion.startMarker);
				editor.cledit.addMarker(discussion.endMarker);
			});
		}

		function updateMarkers() {
			commenting.discussions.forEach(function(discussion) {
				discussion.startMarker.offset = discussion.discussionDao.start;
				discussion.endMarker.offset = discussion.discussionDao.end;
			});
		}

		function refreshCoordinates() {
			yList = [];
			commenting.discussions.sort(function(discussion1, discussion2) {
				return discussion1.endMarker.offset - discussion2.endMarker.offset;
			}).forEach(function(discussion) {
				var coordinates = editor.cledit.selectionMgr.getCoordinates(discussion.endMarker.offset);
				discussion.setTopOffset(coordinates.y);
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
			catch(e) {
			}
		}

		return commenting;
	});
