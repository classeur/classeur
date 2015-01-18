angular.module('classeur.extensions.commenting', [])
	.directive('clCommentingGutter', function($timeout, clCommentingSvc) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/commentingGutter.html',
			scope: true,
			link: function(scope) {
				scope.commentingSvc = clCommentingSvc;
				clCommentingSvc.fileDao = scope.fileDao;

				scope.setCurrentDiscussion = function(discussion) {
					// Select modifies editor selection which provokes comment dismiss
					clCommentingSvc.select(discussion);
					$timeout(function() {
						// Need to delay this as it's not refreshed properly
						clCommentingSvc.highlight();
					}, 180);
				};

				scope.$watch('editorSvc.editorSize()', clCommentingSvc.refreshCoordinates);
				scope.$watch('editorSvc.sectionList', clCommentingSvc.refreshCoordinates);
				scope.$watch('editorLayoutSvc.currentControl', function(currentControl) {
					if(currentControl !== 'discussion') {
						clCommentingSvc.currentDiscussion = undefined;
						clCommentingSvc.undoHighlight();
					}
				});

				scope.$watch('commentingSvc.lastDiscussionChanged', function() {
					clCommentingSvc.updateDiscussions();
					clCommentingSvc.refreshCoordinates();
				});
				scope.$watch('commentingSvc.lastDiscussionOffsetChanged', function() {
					clCommentingSvc.updateMarkers();
					clCommentingSvc.refreshCoordinates();
				});
			}
		};
	})
	.directive('clCommentingButton', function(clCommentingSvc) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/commentingButton.html',
			link: function(scope) {
				var discussion = scope.discussion;
				scope.$watchGroup(['discussion.startMarker.offset', 'discussion.endMarker.offset'], function() {
					discussion.discussionDao.start = discussion.startMarker.offset;
					discussion.discussionDao.end = discussion.endMarker.offset;
					clCommentingSvc.lastDiscussionOffsetChanged = Date.now();
				});
			}
		};
	})
	.directive('clDiscussion', function(clCommentingSvc, clEditorLayoutSvc, clDraggablePanel) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/discussion.html',
			scope: true,
			link: function(scope, element) {
				clDraggablePanel(element, '.discussion.panel', 0, 0, -1.5);

				scope.commenting = clCommentingSvc;
				scope.removeDiscussion = function(discussion) {
					clEditorLayoutSvc.currentControl = undefined;
					delete clCommentingSvc.fileDao.discussions[discussion.discussionDao.id];
					clCommentingSvc.lastDiscussionChanged = Date.now();
				};
			}
		};
	})
	.directive('clCommentInput', function(clCommentingSvc, clUserSvc, clEditorLayoutSvc) {

		return {
			link: function(scope, element) {

				var inputElt = element[0].querySelector('textarea');
				inputElt.addEventListener('mousedown', function(e) {
					e.stopPropagation();
				});
				inputElt.addEventListener('keydown', function(e) {
					// Check enter key
					if(e.which !== 13) {
						return;
					}
					e.preventDefault();
					var discussionDao = clCommentingSvc.currentDiscussion.discussionDao;
					if(discussionDao && clCommentingSvc.newCommentContent) {
						discussionDao.comments.push({
							user: clUserSvc.localId,
							content: clCommentingSvc.newCommentContent
						});
						clCommentingSvc.newCommentContent = undefined;
						clEditorLayoutSvc.currentControl = undefined;
						clCommentingSvc.fileDao.users[clUserSvc.localId] = clUserSvc.name;
						clCommentingSvc.lastDiscussionChanged = Date.now();
						scope.$apply();
					}
				});
				setTimeout(function() {
					inputElt.focus();
				}, 100);
			}
		};
	})
	.factory('clCommentingSvc', function(clEditorSvc, clEditorLayoutSvc, clSettingSvc) {
		var commentButtonHeight = 30;
		var yList = [];

		var commentingSvc = {
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
					user: fileDao.users[commentModelObject.user] || clSettingSvc.values.defaultUserName,
					content: commentModelObject.content
				};
			});
			this.topOffset = '-100px';
		}

		Discussion.prototype.setTopOffset = function(y, isNew) {
			y = Math.round(y);
			// Prevent overlap of comment icons
			var yListIndex = y - commentButtonHeight + 1;
			while(yListIndex < y + commentButtonHeight) {
				if(yList[yListIndex]) {
					y = yListIndex + commentButtonHeight;
				}
				yListIndex++;
			}
			!isNew && (yList[y] = 1);
			this.topOffset = (y - commentButtonHeight / 2 + 2) + 'px';
		};

		function updateDiscussions() {
			commentingSvc.discussions.forEach(function(discussion) {
				clEditorSvc.cledit.removeMarker(discussion.startMarker);
				clEditorSvc.cledit.removeMarker(discussion.endMarker);
			});
			commentingSvc.discussions = [];
			angular.forEach(commentingSvc.fileDao.discussions, function(discussionDao) {
				var discussion = new Discussion(discussionDao, commentingSvc.fileDao);
				commentingSvc.discussions.push(discussion);
				clEditorSvc.cledit.addMarker(discussion.startMarker);
				clEditorSvc.cledit.addMarker(discussion.endMarker);
			});
		}

		function updateMarkers() {
			commentingSvc.discussions.forEach(function(discussion) {
				discussion.startMarker.offset = discussion.discussionDao.start;
				discussion.endMarker.offset = discussion.discussionDao.end;
			});
		}

		function refreshCoordinates() {
			yList = [];
			commentingSvc.discussions.sort(function(discussion1, discussion2) {
				return discussion1.endMarker.offset - discussion2.endMarker.offset;
			}).forEach(function(discussion) {
				var coordinates = clEditorSvc.cledit.selectionMgr.getCoordinates(discussion.endMarker.offset);
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
			var range = clEditorSvc.cledit.selectionMgr.setSelectionStartEnd(discussion.startMarker.offset, discussion.endMarker.offset);
			// Create rangy range
			selectionRange = window.rangy.createRange();
			selectionRange.setStart(range.startContainer, range.startOffset);
			selectionRange.setEnd(range.endContainer, range.endOffset);
		}

		function highlight() {
			this.currentDiscussion = selectedDiscussion;
			clEditorLayoutSvc.currentControl = 'discussion';
			classApplier.applyToRange(selectionRange);
		}

		function undoHighlight() {
			try {
				classApplier.undoToRange(selectionRange);
			}
			catch(e) {
			}
		}

		return commentingSvc;
	});
