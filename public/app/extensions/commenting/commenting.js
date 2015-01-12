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

				scope.$watch('editor.editorSize()', commenting.refreshCoordinates);
				scope.$watch('editor.sectionList', commenting.refreshCoordinates);
				scope.$watch('layout.currentControl', function(currentControl) {
					if(currentControl !== 'discussion') {
						commenting.currentDiscussion = undefined;
						commenting.undoHighlight();
					}
				});

				commenting.fileDao = scope.files.currentFileDao;
				scope.$watch('onDiscussionChanged', function() {
					commenting.updateDiscussions();
					commenting.refreshCoordinates();
				});
				scope.$watch('onDiscussionOffsetChanged', function() {
					commenting.updateMarkers();
					commenting.refreshCoordinates();
				});
			}
		};
	})
	.directive('clCommentingButton', function() {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/commentingButton.html',
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
	.directive('clDiscussion', function(commenting, layout, panel) {
		var Hammer = window.Hammer;

		return {
			restrict: 'E',
			templateUrl: 'app/extensions/commenting/discussion.html',
			scope: true,
			link: function(scope, element) {
				var x = 0, y = 0;
				var discussionPanel = panel(element, '.discussion.panel');
				discussionPanel.move().rotate(-1.5)
					.then().to(x, y).duration(180).ease('ease-out-back').pop()
					.end();

				var hammertime = new Hammer(element[0]);
				hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 0 });
				hammertime.on('panmove', function(evt) {
					evt.preventDefault();
					discussionPanel.move().rotate(-1.5).to(x + evt.deltaX, y + evt.deltaY).end();
				});
				hammertime.on('panend', function(evt) {
					x += evt.deltaX;
					y += evt.deltaY;
				});

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
