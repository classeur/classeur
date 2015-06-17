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
						selectionStart: selectionStart,
						selectionEnd: selectionEnd,
						patches: clDiscussionSvc.offsetToPatch(text, {
							start: selectionStart, 
							end: selectionEnd
						})
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
				]);
			}

			function patchToOffset(text, patches) {
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
