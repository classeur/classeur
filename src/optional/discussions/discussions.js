angular.module('classeur.optional.discussions', [])
	.directive('clDiscussionDecorator',
		function($window, $timeout, clEditorSvc, clEditorLayoutSvc, clDiscussionSvc, clLocalSettingSvc, clDiffUtils) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/discussionDecorator.html',
				link: link
			};

			function link(scope, element) {
				var selection,
					contentDao = scope.currentFileDao.contentDao;

				setTimeout(function() {
					function getEditorDiscussionId(elt) {
						while (elt && elt !== clEditorSvc.editorElt) {
							if (elt.discussionId) {
								return elt.discussionId;
							}
							elt = elt.parentNode;
						}
					}
					clEditorSvc.editorElt.addEventListener('mouseover', function(evt) {
						var discussionId = getEditorDiscussionId(evt.target);
						discussionId && clEditorSvc.editorElt.getElementsByClassName('discussion-editor-highlighting-' + discussionId).cl_each(function(elt) {
							elt.classList.add('hover');
						});
					});
					clEditorSvc.editorElt.addEventListener('mouseout', function(evt) {
						var discussionId = getEditorDiscussionId(evt.target);
						discussionId && clEditorSvc.editorElt.getElementsByClassName('discussion-editor-highlighting-' + discussionId).cl_each(function(elt) {
							elt.classList.remove('hover');
						});
					});
					clEditorSvc.editorElt.addEventListener('click', function(evt) {
						var discussionId = getEditorDiscussionId(evt.target);
						if (discussionId && contentDao.discussions.hasOwnProperty(discussionId)) {
							clLocalSettingSvc.values.sideBar = true;
							clEditorLayoutSvc.sideBarTab = 'discussions';
							clDiscussionSvc.currentDiscussion = contentDao.discussions[discussionId];
							clDiscussionSvc.currentDiscussionId = discussionId;
						}
					});

					function getPreviewDiscussionId(elt) {
						while (elt && elt !== clEditorSvc.previewElt) {
							if (elt.discussionId) {
								return elt.discussionId;
							}
							elt = elt.parentNode;
						}
					}
					clEditorSvc.previewElt.addEventListener('mouseover', function(evt) {
						var discussionId = getPreviewDiscussionId(evt.target);
						discussionId && clEditorSvc.previewElt.getElementsByClassName('discussion-preview-highlighting-' + discussionId).cl_each(function(elt) {
							elt.classList.add('hover');
						});
					});
					clEditorSvc.previewElt.addEventListener('mouseout', function(evt) {
						var discussionId = getPreviewDiscussionId(evt.target);
						discussionId && clEditorSvc.previewElt.getElementsByClassName('discussion-preview-highlighting-' + discussionId).cl_each(function(elt) {
							elt.classList.remove('hover');
						});
					});
					clEditorSvc.previewElt.addEventListener('click', function(evt) {
						var discussionId = getPreviewDiscussionId(evt.target);
						if (discussionId && contentDao.discussions.hasOwnProperty(discussionId)) {
							clLocalSettingSvc.values.sideBar = true;
							clEditorLayoutSvc.sideBarTab = 'discussions';
							clDiscussionSvc.currentDiscussion = contentDao.discussions[discussionId];
							clDiscussionSvc.currentDiscussionId = discussionId;
						}
					});
				}, 1);

				var newDiscussionBtnElt = element[0].querySelector('.new-discussion-btn');
				var lastCoordinates = {};

				function checkSelection() {
					var selectionMgr = clEditorSvc.cledit && clEditorSvc.cledit.selectionMgr;
					if (selectionMgr) {
						selection = clDiscussionSvc.getTrimmedSelection(selectionMgr);
						var coordinates = selectionMgr.cursorCoordinates;
						if (selection && coordinates.top !== undefined) {
							if (coordinates.top !== lastCoordinates.top ||
								coordinates.height !== lastCoordinates.height ||
								coordinates.left !== lastCoordinates.left
							) {
								lastCoordinates = coordinates;
								newDiscussionBtnElt.clanim
									.top(coordinates.top + coordinates.height)
									.left(coordinates.left + clEditorLayoutSvc.editorLeftOverflow)
									.start();
							}
							return clEditorSvc.cledit.selectionMgr.hasFocus;
						}
					}
				}

				var showButton = $window.cledit.Utils.debounce(function() {
					if (checkSelection()) {
						scope.show = true;
						scope.$apply();
					}
				}, 500);

				var hideButton = $window.cledit.Utils.debounce(function() {
					if (!checkSelection()) {
						scope.show = false;
						scope.$apply();
					}
				}, 250);

				function toggleButton() {
					if (!checkSelection()) {
						scope.show && hideButton();
					} else {
						showButton();
					}
				}
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
					if (!selection) {
						return;
					}
					clDiscussionSvc.newDiscussion.text = text.slice(selection.start, selection.end).slice(0, 500);
					if (!text) {
						return;
					}
					clDiscussionSvc.newDiscussion.patches = [
						clDiffUtils.offsetToPatch(text, selection.start),
						clDiffUtils.offsetToPatch(text, selection.end)
					];
					// Force recreate the highlighter
					clDiscussionSvc.currentDiscussion = undefined;
					clDiscussionSvc.currentDiscussionId = undefined;
					$timeout(function() {
						clLocalSettingSvc.values.sideBar = true;
						clEditorLayoutSvc.sideBarTab = 'discussions';
						clDiscussionSvc.currentDiscussion = clDiscussionSvc.newDiscussion;
						clDiscussionSvc.currentDiscussionId = clDiscussionSvc.newDiscussionId;
					});
				};

				scope.$watch('discussionSvc.currentDiscussionId', function(currentDiscussionId) {
					$window.document.querySelectorAll('.discussion-editor-highlighting.selected, .discussion-preview-highlighting.selected').cl_each(function(elt) {
						elt.classList.remove('selected');
					});
					currentDiscussionId && $window.document.querySelectorAll(
						'.discussion-editor-highlighting-' + currentDiscussionId +
						', .discussion-preview-highlighting-' + currentDiscussionId
					).cl_each(function(elt) {
						elt.classList.add('selected');
					});
				});
			}
		})
	.directive('clDiscussionHighlighter',
		function(clEditorSvc, clEditorClassApplier, clPreviewClassApplier, clDiffUtils) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				var offset;

				var editorClassApplier = clEditorClassApplier(['discussion-editor-highlighting-' + scope.discussionId, 'discussion-editor-highlighting'], function() {
					if (!clEditorSvc.cledit.options) {
						return; // cledit not inited
					}
					var text = clEditorSvc.cledit.getContent();
					offset = {
						start: clDiffUtils.patchToOffset(text, scope.discussion.patches[0]),
						end: clDiffUtils.patchToOffset(text, scope.discussion.patches[1])
					};
					return offset.start !== -1 && offset.end !== -1 && offset;
				}, {
					discussionId: scope.discussionId
				});

				var previewClassApplier = clPreviewClassApplier(['discussion-preview-highlighting-' + scope.discussionId, 'discussion-preview-highlighting'], function() {
					if (!offset || offset.start === -1 || offset.end === -1) {
						return;
					}
					var start = clEditorSvc.getPreviewOffset(offset.start);
					var end = clEditorSvc.getPreviewOffset(offset.end);
					return start !== undefined && end !== undefined && {
						start: start,
						end: end
					};
				}, {
					discussionId: scope.discussionId
				});

				scope.$watch('editorSvc.lastTextToPreviewDiffs', function(value) {
					value && previewClassApplier.restore();
				});
				scope.$on('$destroy', function() {
					editorClassApplier && editorClassApplier.stop();
					previewClassApplier && previewClassApplier.remove();
				});
			}
		})
	.directive('clDiscussionTab',
		function($window, $timeout, clDiscussionSvc, clEditorSvc, clToast, clDiffUtils) {
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
				scope.$watch('localSettingSvc.values.sideBar && editorLayoutSvc.sideBarTab === "discussions"', function(isOpen) {
					if (!isOpen) {
						clDiscussionSvc.currentDiscussion = undefined;
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				});
				var contentDao = scope.currentFileDao.contentDao;

				scope.createDiscussion = function() {
					var text = clEditorSvc.cledit.getContent();
					var selection = clDiscussionSvc.getTrimmedSelection(clEditorSvc.cledit.selectionMgr);
					if (!selection) {
						return clToast('Please select some text first.');
					}
					clDiscussionSvc.newDiscussion.text = text.slice(selection.start, selection.end).slice(0, 1000);
					clDiscussionSvc.newDiscussion.patches = [
						clDiffUtils.offsetToPatch(text, selection.start),
						clDiffUtils.offsetToPatch(text, selection.end)
					];
					// Force recreate the highlighter
					clDiscussionSvc.currentDiscussion = undefined;
					clDiscussionSvc.currentDiscussionId = undefined;
					$timeout(function() {
						clDiscussionSvc.currentDiscussion = clDiscussionSvc.newDiscussion;
						clDiscussionSvc.currentDiscussionId = clDiscussionSvc.newDiscussionId;
					});
				};

				function refreshLastComments() {
					if (!scope.currentFileDao || scope.currentFileDao.state !== 'loaded') {
						return;
					}
					var lastComments = Object.keys(contentDao.comments).cl_reduce(function(lastComments, commentId) {
						var comment = contentDao.comments[commentId];
						if (scope.currentFileDao.contentDao.discussions.hasOwnProperty(comment.discussionId)) {
							var lastComment = lastComments[comment.discussionId] || comment;
							lastComment = comment.created > lastComment.created ? comment : lastComment;
							lastComments[comment.discussionId] = lastComment;
						}
						return lastComments;
					}, {});
					scope.lastComments = lastComments.cl_map(function(lastComment, discussionId) {
						return {
							discussionId: discussionId,
							userId: lastComment.userId,
							created: lastComment.created,
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
		function($window, clDiscussionSvc, clDialog, clToast, clEditorSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionItem.html',
				link: link
			};

			function link(scope, element) {
				var contentDao = scope.currentFileDao.contentDao;
				scope.refreshComments = function() {
					if (!scope.currentFileDao || scope.currentFileDao.state !== 'loaded') {
						return;
					}
					scope.comments = Object.keys(contentDao.comments).cl_filter(function(commentId) {
						return contentDao.comments[commentId].discussionId === scope.discussionId;
					}).cl_map(function(commentId) {
						var comment = ({}).cl_extend(contentDao.comments[commentId]);
						comment.id = commentId;
						return comment;
					}).sort(function(comment1, comment2) {
						return comment1.created > comment2.created;
					});
					scope.chips = [scope.comments.length];
				};
				scope.selectDiscussion = function() {
					if (clDiscussionSvc.currentDiscussion !== scope.discussion) {
						clDiscussionSvc.currentDiscussion = scope.discussion;
						clDiscussionSvc.currentDiscussionId = scope.discussionId;
						setTimeout(function() {
							var elt = $window.document.querySelector('.discussion-editor-highlighting-' + scope.discussionId);
							if (!elt) {
								return clToast('Discussion can\'t be located in the file.');
							}
							var offset = elt.offsetTop - clEditorSvc.scrollOffset;
							var scrollerElt = clEditorSvc.editorElt.parentNode;
							scrollerElt.clanim.scrollTop(offset < 0 ? 0 : offset).duration(400).easing('materialOut').start();
						}, 10);
					} else if (clDiscussionSvc.currentDiscussion !== clDiscussionSvc.newDiscussion) {
						clDiscussionSvc.currentDiscussion = undefined;
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				};
				scope.deleteDiscussion = function() {
					if (!scope.lastComment) {
						// That's the new discussion
						clDiscussionSvc.currentDiscussion = undefined;
						clDiscussionSvc.currentDiscussionId = undefined;
					} else {
						var deleteDialog = clDialog.confirm()
							.title('Delete discussion')
							.content('You\'re about to delete a discussion. Are you sure?')
							.ariaLabel('Delete discussion')
							.ok('Yes')
							.cancel('No');
						clDialog.show(deleteDialog).then(function() {
							delete contentDao.discussions[scope.discussionId];
							contentDao.comments = Object.keys(contentDao.comments).cl_reduce(function(comments, commentId) {
								var comment = contentDao.comments[commentId];
								if (comment.discussionId !== scope.discussionId) {
									comments[commentId] = comment;
								}
								return comments;
							}, {});
						});
					}
				};
				scope.discussionSvc = clDiscussionSvc;
				if (scope.lastComment) {
					scope.discussionId = scope.lastComment.discussionId;
					scope.discussion = contentDao.discussions[scope.discussionId];
					scope.$watch('currentFileDao.contentDao.comments', scope.refreshComments);
				}

				var elt = element[0];
				var scrollerElt = elt;
				while (scrollerElt && scrollerElt.tagName !== 'MD-TAB-CONTENT') {
					scrollerElt = scrollerElt.parentNode;
				}
				scope.$watch('discussionSvc.currentDiscussion === discussion', function(isCurrent) {
					isCurrent && setTimeout(function() {
						if (elt.firstChild.offsetHeight > scrollerElt.offsetHeight) {
							scrollerElt.scrollTop = elt.offsetTop + elt.firstChild.offsetHeight - scrollerElt.offsetHeight + 10;
						} else {
							scrollerElt.scrollTop = elt.offsetTop - 25;
						}
					}, 10);
				});
			}
		})
	.directive('clDiscussionCommentList',
		function($window, clUid, clDiscussionSvc, clUserSvc, clDialog, clEditorSvc, clToast) {
			var lastContent = '',
				lastSelectionStart = 0,
				lastSelectionEnd = 0;

			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionCommentList.html',
				link: link
			};

			function link(scope, element) {
				var contentDao = scope.currentFileDao.contentDao;
				var newDiscussionCommentElt = element[0].querySelector('.discussion.comment');
				var cledit = $window.cledit(newDiscussionCommentElt);
				cledit.addKeystroke(new $window.cledit.Keystroke(function(evt) {
					if (evt.shiftKey || evt.which !== 13) {
						return;
					}
					setTimeout(scope.addComment, 10);
					evt.preventDefault();
					return true;
				}, 40));

				cledit.init({
					highlighter: clEditorSvc.options.highlighter,
					content: lastContent,
					selectionStart: lastSelectionStart,
					selectionEnd: lastSelectionEnd,
				});
				setTimeout(function() {
					cledit.focus();
				}, 10);

				scope.addComment = function() {
					var commentText = cledit.getContent().trim();
					if (!commentText) {
						return;
					}
					if (commentText.length > 2000) {
						return clToast('Comment text is too long.');
					}
					if (contentDao.comments.length > 1999) {
						return clToast('Too many comments in the file.');
					}
					var discussionId = scope.discussionId;
					if (discussionId === clDiscussionSvc.newDiscussionId) {
						if (Object.keys(contentDao.discussions).length > 99) {
							return clToast('Too many discussions in the file.');
						}
						// Create new discussion
						discussionId = clUid();
						var discussion = {
							text: scope.discussion.text,
							patches: scope.discussion.patches,
						};
						contentDao.discussions[discussionId] = discussion;
						clDiscussionSvc.currentDiscussion = discussion;
						clDiscussionSvc.currentDiscussionId = discussionId;
					}
					cledit.setContent('');
					var comment = {
						discussionId: discussionId,
						userId: clUserSvc.user.id,
						text: commentText,
						created: Date.now(),
					};
					contentDao.comments[clUid()] = comment;
					scope.lastComments[discussionId] = comment;
					scope.discussionId && scope.refreshComments();
				};

				scope.deleteComment = function(commentId) {
					var deleteDialog = clDialog.confirm()
						.title('Delete comment')
						.content('You\'re about to delete a comment. Are you sure?')
						.ariaLabel('Delete comment')
						.ok('Yes')
						.cancel('No');
					clDialog.show(deleteDialog).then(function() {
						delete contentDao.comments[commentId];
						scope.refreshComments();
					});
				};

				scope.$on('$destroy', function() {
					lastContent = cledit.getContent();
					lastSelectionStart = cledit.selectionMgr.selectionStart;
					lastSelectionEnd = cledit.selectionMgr.selectionEnd;
				});
			}
		})
	.filter('clConvertMarkdown',
		function($sce, clEditorSvc, clHtmlSanitizer) {
			return function(value) {
				return $sce.trustAsHtml(clHtmlSanitizer(clEditorSvc.markdown.render(value || '')));
			};
		})
	.factory('clDiscussionSvc',
		function($window, clUid, clEditorSvc) {
			return {
				newDiscussion: {},
				newDiscussionId: clUid(),
				getTrimmedSelection: function(selectionMgr) {
					var text = clEditorSvc.cledit.getContent();
					var start = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
					var end = Math.max(selectionMgr.selectionStart, selectionMgr.selectionEnd);
					while ((text[start] || '').match(/\s/)) {
						start++;
					}
					while ((text[end - 1] || '').match(/\s/)) {
						end--;
					}
					return start < end && {
						start: start,
						end: end,
					};
				}
			};
		});
