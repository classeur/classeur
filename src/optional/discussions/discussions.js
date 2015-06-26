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
				var selectionStart, selectionEnd;
				var parentElt = element[0].parentNode;
				parentElt.addEventListener('mouseover', function(evt) {
					var elt = evt.target;
					while (elt && elt !== parentElt) {
						if (elt.discussionId) {
							Array.prototype.slice.call(parentElt.getElementsByClassName('discussion-highlighting-' + elt.discussionId)).forEach(function(elt) {
								elt.classList.add('hover');
							});
							break;
						}
						elt = elt.parentNode;
					}
				});
				parentElt.addEventListener('mouseout', function(evt) {
					var elt = evt.target;
					while (elt && elt !== parentElt) {
						if (elt.discussionId) {
							Array.prototype.slice.call(parentElt.getElementsByClassName('discussion-highlighting-' + elt.discussionId)).forEach(function(elt) {
								elt.classList.remove('hover');
							});
							break;
						}
						elt = elt.parentNode;
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
					scope.discussion.text = text.slice(selectionStart, selectionEnd);
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
	.directive('clDiscussionPanel',
		function($window, clDiscussionSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/discussionPanel.html',
				link: link
			};

			function link(scope) {
				scope.discussionSvc = clDiscussionSvc;
				scope.$watch('discussionSvc.currentDiscussion', function(currentDiscussion) {
					scope.discussion = currentDiscussion === clDiscussionSvc.newDiscussion && currentDiscussion;
				});
			}
		})
	.directive('clDiscussionItem',
		function($window, clUid, clDiscussionSvc, clUserSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionItem.html',
				link: link
			};

			function link(scope, element) {
				function refreshComments() {
					scope.comments = contentDao.comments.filter(function(comment) {
						return comment.discussionId === scope.discussionId;
					}).map(function(comment) {
						// Make a copy to prevent storing angular id in the original object
						return angular.extend({}, comment);
					});
				}
				scope.discussionSvc = clDiscussionSvc;
				var contentDao = scope.currentFileDao.contentDao;
				scope.discussionId && scope.$watch('currentFileDao.contentDao.comments', refreshComments);
				var newDiscussionCommentElt = element[0].querySelector('.discussion.comment');
				var cledit = $window.cledit(newDiscussionCommentElt);
				var grammar = $window.mdGrammar();
				cledit.init({
					highlighter: function(text) {
						return $window.Prism.highlight(text, grammar);
					}
				});
				scope.addComment = function() {
					var commentText = cledit.getContent().trim();
					if (!commentText) {
						return;
					}
					var discussionId = scope.discussionId;
					if (!discussionId) {
						discussionId = clUid();
						var discussion = {
							text: scope.discussion.text,
							patches: scope.discussion.patches,
						};
						contentDao.discussions[discussionId] = discussion;
						clDiscussionSvc.currentDiscussion = discussion;
						clDiscussionSvc.currentDiscussionId = discussionId;
					}
					contentDao.comments.push({
						discussionId: discussionId,
						userId: clUserSvc.user.id,
						text: commentText,
						created: Date.now(),
					});
					contentDao.comments.sort(function(comment1, comment2) {
						return comment1.created - comment2.created;
					});
					scope.discussionId && refreshComments();
				};
			}
		})
	.filter('clConvertMarkdown',
		function(clEditorSvc, $sce) {
			return function(value) {
				if (!clEditorSvc.hasInitListener(90)) {
					// No sanitizer
					return;
				}
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
