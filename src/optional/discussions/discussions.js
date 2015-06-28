angular.module('classeur.optional.discussions', [])
	.directive('clDiscussionDecorator',
		function($window, $timeout, clEditorSvc, clEditorLayoutSvc, clPanel, clDiscussionSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/discussionDecorator.html',
				link: link
			};

			function link(scope, element) {
				var maxDiscussionTextLength = 1000;
				var selectionStart, selectionEnd;
				var parentElt = element[0].parentNode;
				var contentDao = scope.currentFileDao.contentDao;

				function getDiscussionId(elt) {
					while (elt && elt !== parentElt) {
						if (elt.discussionId) {
							return elt.discussionId;
						}
						elt = elt.parentNode;
					}
				}
				parentElt.addEventListener('mouseover', function(evt) {
					var discussionId = getDiscussionId(evt.target);
					discussionId && Array.prototype.slice.call(parentElt.getElementsByClassName('discussion-highlighting-' + discussionId)).forEach(function(elt) {
						elt.classList.add('hover');
					});
				});
				parentElt.addEventListener('mouseout', function(evt) {
					var discussionId = getDiscussionId(evt.target);
					discussionId && Array.prototype.slice.call(parentElt.getElementsByClassName('discussion-highlighting-' + discussionId)).forEach(function(elt) {
						elt.classList.remove('hover');
					});
				});
				parentElt.addEventListener('click', function(evt) {
					var discussionId = getDiscussionId(evt.target);
					if (discussionId && contentDao.discussions.hasOwnProperty(discussionId)) {
						clEditorLayoutSvc.isSideBarOpen = true;
						clEditorLayoutSvc.sideBarTab = 'discussions';
						clDiscussionSvc.currentDiscussion = contentDao.discussions[discussionId];
						clDiscussionSvc.currentDiscussionId = discussionId;
					}
				});

				var toggleButton = $window.cledit.Utils.debounce(function() {
					scope.show = false;
					var selectionMgr = clEditorSvc.cledit.selectionMgr;
					if (clEditorSvc.cledit && selectionMgr.hasFocus) {
						selectionStart = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
						selectionEnd = Math.max(selectionMgr.selectionStart, selectionMgr.selectionEnd);
						scope.coordinates = selectionMgr.cursorCoordinates;
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
				scope.discussion = clDiscussionSvc.newDiscussion;
				scope.discussionId = clDiscussionSvc.newDiscussionId;
				scope.createDiscussion = function() {
					var text = clEditorSvc.cledit.getContent();
					scope.discussion.text = text.slice(selectionStart, selectionEnd).slice(0, maxDiscussionTextLength);
					scope.discussion.patches = clDiscussionSvc.offsetToPatch(text, {
						start: selectionStart,
						end: selectionEnd
					});
					// Force recreating the highlighter
					clDiscussionSvc.currentDiscussion = undefined;
					clDiscussionSvc.currentDiscussionId = undefined;
					$timeout(function() {
						clEditorLayoutSvc.isSideBarOpen = true;
						clEditorLayoutSvc.sideBarTab = 'discussions';
						clDiscussionSvc.currentDiscussion = clDiscussionSvc.newDiscussion;
						clDiscussionSvc.currentDiscussionId = clDiscussionSvc.newDiscussionId;
					});
				};

				scope.$watch('discussionSvc.currentDiscussionId', function(currentDiscussionId) {
					Array.prototype.slice.call(parentElt.querySelectorAll('.discussion-highlighting.selected')).forEach(function(elt) {
						elt.classList.remove('selected');
					});
					currentDiscussionId && Array.prototype.slice.call(parentElt.getElementsByClassName('discussion-highlighting-' + currentDiscussionId)).forEach(function(elt) {
						elt.classList.add('selected');
					});
				});
			}
		})
	.directive('clDiscussionHighlighter',
		function(clEditorSvc, clEditorClassApplier, clDiscussionSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				var classApplier = clEditorClassApplier(['discussion-highlighting-' + scope.discussionId, 'discussion-highlighting'], function() {
					var text = clEditorSvc.cledit.getContent();
					return clDiscussionSvc.patchToOffset(text, scope.discussion.patches);
				}, {
					discussionId: scope.discussionId
				});

				scope.$on('$destroy', function() {
					classApplier && classApplier.stop();
				});
			}
		})
	.directive('clDiscussionTab',
		function($window, clDiscussionSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/discussionTab.html',
				link: link
			};

			function link(scope) {
				scope.discussionSvc = clDiscussionSvc;
				scope.$watch('discussionSvc.currentDiscussion === discussionSvc.newDiscussion', function(isNew) {
					scope.discussion = isNew && clDiscussionSvc.newDiscussion;
					scope.discussionId = isNew && clDiscussionSvc.newDiscussionId;
				});
				scope.$watch('editorLayoutSvc.isSideBarOpen && editorLayoutSvc.sideBarTab === "discussions"', function(isOpen) {
					if (!isOpen) {
						clDiscussionSvc.currentDiscussion = undefined;
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				});

				function refreshLastComments() {
					var lastComments = scope.currentFileDao.contentDao.comments.reduce(function(lastComments, comment) {
						if (scope.currentFileDao.contentDao.discussions.hasOwnProperty(comment.discussionId)) {
							var lastComment = lastComments[comment.discussionId] || comment;
							lastComment = comment.created > lastComment.created ? comment : lastComment;
							lastComments[comment.discussionId] = lastComment;
						}
						return lastComments;
					}, {});
					scope.lastComments = Object.keys(lastComments).map(function(discussionId) {
						return {
							discussionId: discussionId,
							userId: lastComments[discussionId].userId,
							created: lastComments[discussionId].created,
						};
					}).sort(function(lastComment1, lastComment2) {
						return lastComment1.created < lastComment2.created;
					});
				}
				scope.$watch('currentFileDao.contentDao.comments', refreshLastComments);
				scope.$watch('discussionSvc.currentDiscussion', refreshLastComments);
			}
		})
	.directive('clDiscussionItem',
		function($window, clDiscussionSvc, clDialog) {
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionItem.html',
				link: link
			};

			function link(scope) {
				var contentDao = scope.currentFileDao.contentDao;
				scope.refreshComments = function() {
					scope.comments = contentDao.comments.filter(function(comment) {
						return comment.discussionId === scope.discussionId;
					});
					scope.chips = [scope.comments.length];
				};
				scope.selectDiscussion = function() {
					if (clDiscussionSvc.currentDiscussion !== scope.discussion) {
						clDiscussionSvc.currentDiscussion = scope.discussion;
						clDiscussionSvc.currentDiscussionId = scope.discussionId;
					} else {
						clDiscussionSvc.currentDiscussion = undefined;
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				};
				scope.deleteDiscussion = function() {
					if (!scope.lastComment) {
						// That the new discussion
						clDiscussionSvc.currentDiscussion = undefined;
						clDiscussionSvc.currentDiscussionId = undefined;
					} else {
						var deleteDialog = clDialog.confirm()
							.title('Delete discussion')
							.content('You about to delete a discussion. Are you sure?')
							.ariaLabel('Delete discussion')
							.ok('Yes')
							.cancel('No');
						clDialog.show(deleteDialog).then(function() {
							delete contentDao.discussions[scope.discussionId];
							contentDao.comments = contentDao.comments.filter(function(comment) {
								return comment.discussionId !== scope.discussionId;
							});
						});
					}
				};
				scope.discussionSvc = clDiscussionSvc;
				if (scope.lastComment) {
					scope.discussionId = scope.lastComment.discussionId;
					scope.discussion = contentDao.discussions[scope.discussionId];
					scope.$watch('currentFileDao.contentDao.comments', scope.refreshComments);
				}
			}
		})
	.directive('clDiscussionCommentList',
		function($window, clUid, clDiscussionSvc, clUserSvc, clDialog) {
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionCommentList.html',
				link: link
			};

			function link(scope, element) {
				var contentDao = scope.currentFileDao.contentDao;
				var newDiscussionCommentElt = element[0].querySelector('.discussion.comment');
				var cledit = $window.cledit(newDiscussionCommentElt);
				cledit.addKeystroke(40, new $window.cledit.Keystroke(function(evt) {
					if (evt.shiftKey || evt.which !== 13) {
						return;
					}
					setTimeout(scope.addComment, 10);
					evt.preventDefault();
					return true;
				}));

				var grammar = $window.mdGrammar();
				cledit.init({
					highlighter: function(text) {
						return $window.Prism.highlight(text, grammar);
					}
				});
				setTimeout(function() {
					cledit.focus();
				}, 10);
				scope.addComment = function() {
					var commentText = cledit.getContent().trim();
					if (!commentText) {
						return;
					}
					cledit.setContent('');
					var discussionId = scope.discussionId;
					if (discussionId === clDiscussionSvc.newDiscussionId) {
						discussionId = clUid();
						var discussion = {
							text: scope.discussion.text,
							patches: scope.discussion.patches,
						};
						contentDao.discussions[discussionId] = discussion;
						clDiscussionSvc.currentDiscussion = discussion;
						clDiscussionSvc.currentDiscussionId = discussionId;
					}
					var comment = {
						discussionId: discussionId,
						userId: clUserSvc.user.id,
						text: commentText,
						created: Date.now(),
					};
					contentDao.comments.push(comment);
					contentDao.comments.sort(function(comment1, comment2) {
						return comment1.created - comment2.created;
					});
					scope.lastComments[discussionId] = comment;
					scope.discussionId && scope.refreshComments();
				};
				scope.deleteComment = function(comment) {
					var deleteDialog = clDialog.confirm()
						.title('Delete comment')
						.content('You about to delete a comment. Are you sure?')
						.ariaLabel('Delete comment')
						.ok('Yes')
						.cancel('No');
					clDialog.show(deleteDialog).then(function() {
						var index = contentDao.comments.indexOf(comment);
						index !== -1 && contentDao.comments.splice(index, 1);
						scope.refreshComments();
					});
				};
			}
		})
	.filter('clConvertMarkdown',
		function(clEditorSvc, $sce) {
			return function(value) {
				return $sce.trustAsHtml(clEditorSvc.converter.makeHtml(value || ''));
			};
		})
	.filter('clHighlightMarkdown',
		function($window, $sce) {
			var grammar = $window.mdGrammar();
			return function(value) {
				return $sce.trustAsHtml($window.Prism.highlight(value || '', grammar));
			};
		})
	.factory('clDiscussionSvc',
		function($window, clUid) {
			var diffMatchPatch = new $window.diff_match_patch();
			diffMatchPatch.Match_Distance = 999999999;
			var marker = '\uF111\uF222\uF333';

			function offsetToPatch(text, offset) {
				return diffMatchPatch.patch_make(text, [
					[0, text.slice(0, offset.start)],
					[1, marker],
					[0, text.slice(offset.start, offset.end)],
					[1, marker],
					[0, text.slice(offset)]
				]).map(function(patch) {
					var diffs = patch.diffs.map(function(diff) {
						if (!diff[0]) {
							return diff[1];
						} else if (diff[1] === marker) {
							return 1;
						}
					});
					return {
						diffs: diffs,
						length: patch.length1,
						start: patch.start1
					};
				});
			}

			function patchToOffset(text, patches) {
				patches = patches.map(function(patch) {
					var markersLength = 0;
					var diffs = patch.diffs.map(function(diff) {
						if (diff === 1) {
							markersLength += marker.length;
							return [1, marker];
						} else {
							return [0, diff];
						}
					});
					return {
						diffs: diffs,
						length1: patch.length,
						length2: patch.length + markersLength,
						start1: patch.start,
						start2: patch.start
					};
				});
				var splitedText = diffMatchPatch.patch_apply(patches, text)[0].split(marker);
				return splitedText.length === 3 && {
					start: splitedText[0].length,
					end: splitedText[0].length + splitedText[1].length
				};
			}

			return {
				newDiscussion: {},
				newDiscussionId: clUid(),
				offsetToPatch: offsetToPatch,
				patchToOffset: patchToOffset,
			};
		});
