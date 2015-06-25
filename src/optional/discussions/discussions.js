angular.module('classeur.optional.discussions', [])
	.directive('clDiscussionDecorator',
		function($window, $timeout, clUid, clEditorSvc, clEditorLayoutSvc, clPanel, clDiscussionSvc) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/discussionDecorator.html',
				link: link
			};

			function link(scope, element) {
				var selectionStart, selectionEnd;
				var parentElt = element[0].parentNode;
				// var hoverElts = parentElt.getElementsByClassName('discussion-highlighting-over');
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
					var text = clEditorSvc.cledit.getContent();
					scope.discussion = {
						id: clUid(),
						isNew: true,
						text: text.slice(selectionStart, selectionEnd),
						patches: clDiscussionSvc.offsetToPatch(text, {
							start: selectionStart,
							end: selectionEnd
						}),
						comments: []
					};
					// Force recreating the highlighter
					$timeout(function() {
						clEditorLayoutSvc.isSideBarOpen = true;
						clEditorLayoutSvc.sideBarTab = 'discussions';
						clDiscussionSvc.currentDiscussion = scope.discussion;
					});
				};
			}
		})
	.directive('clDiscussionHighlighter',
		function(clEditorSvc, clEditorClassApplier, clDiscussionSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				var classApplier = clEditorClassApplier(['discussion-highlighting-' + scope.discussion.id, 'discussion-highlighting'], function() {
					var text = clEditorSvc.cledit.getContent();
					return clDiscussionSvc.patchToOffset(text, scope.discussion.patches);
				}, {
					discussionId: scope.discussion.id
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
					scope.discussion = currentDiscussion && currentDiscussion.isNew && currentDiscussion;
				});
			}
		})
	.directive('clDiscussionItem',
		function($window, clDiscussionSvc, clUserSvc) {
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionItem.html',
				link: link
			};

			function link(scope, element) {
				scope.discussionSvc = clDiscussionSvc;
				var newDiscussionCommentElt = element[0].querySelector('.discussion.comment');
				var cledit = $window.cledit(newDiscussionCommentElt);
				var grammar = $window.mdGrammar();
				cledit.init({
					highlighter: function(text) {
						return $window.Prism.highlight(text, grammar);
					}
				});
				var contentDao = scope.currentFileDao.contentDao;
				scope.addComment = function() {
					var commentText = cledit.getContent().trim();
					if (!commentText) {
						return;
					}
					if (scope.discussion.isNew) {
						contentDao.discussions[scope.discussion.id] = {
							text: scope.discussion.text,
							patches: scope.discussion.patches,
						};
					}
					var comment = {
						discussionId: scope.discussion.id,
						userId: clUserSvc.user.id,
						text: commentText,
						created: Date.now(),
					};
					scope.discussion.comments.push(comment);
					contentDao.comments.push(comment);
					contentDao.comments.sort(function(comment1, comment2) {
						return comment1.created - comment2.created;
					});
				};
			}
		})
	.filter('clConvertMarkdown',
		function(clEditorSvc, $sce) {
			return function(value) {
				if (!clEditorSvc.hasInitListener(90)) {
					// No sanitizer
					return '';
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
		function($window) {
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
				offsetToPatch: offsetToPatch,
				patchToOffset: patchToOffset,
			};
		});
