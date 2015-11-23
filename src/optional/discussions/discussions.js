angular.module('classeur.optional.discussions', [])
	.directive('clEditorDiscussionDecorator',
		function($window, $timeout, clEditorSvc, clEditorLayoutSvc, clDiscussionSvc, clLocalSettingSvc, clDiffUtils) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/editorDiscussionDecorator.html',
				link: link
			};

			function link(scope, element) {
				var selection,
					contentDao = scope.currentFileDao.contentDao;

				var unwatch = scope.$watch('editorSvc.cledit', function(cledit) {
					if (!cledit) {
						return;
					}
					unwatch();

					var newDiscussionBtnElt = element[0].querySelector('.new-discussion-btn');
					var lastCoordinates = {};

					function checkSelection() {
						var selectionMgr = clEditorSvc.cledit && clEditorSvc.cledit.selectionMgr;
						if (selectionMgr) {
							selection = clDiscussionSvc.getTrimmedSelection(selectionMgr);
							if (!selection) {
								return;
							}
							var offset = selection.end;
							var text = clEditorSvc.cledit.getContent();
							while (offset && text[offset - 1] && text[offset - 1] === '\n') {
								offset--;
							}
							if (!offset) {
								return;
							}
							var coordinates = selectionMgr.getCoordinates(offset);
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
							return true;
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
							clLocalSettingSvc.values.sideBarTab = 'discussions';
							clDiscussionSvc.currentDiscussionId = discussionId;
						}
					});

					cledit.selectionMgr.on('selectionChanged', toggleButton);
					cledit.selectionMgr.on('cursorCoordinatesChanged', toggleButton);
					cledit.on('focus', toggleButton);
					cledit.on('blur', toggleButton);
					cledit.on('contentChanged', clDiscussionSvc.updateEditorPostitPosition);
				});

				var isDestroyed = false;
				clDiscussionSvc.updateEditorPostitPosition = $window.cledit.Utils.debounce(function() {
					if (!isDestroyed) {
						clDiscussionSvc.discussionsByOffset = Object.keys(contentDao.discussions).cl_filter(function(discussionId) {
							return clDiscussionSvc.discussionOffsets.hasOwnProperty(discussionId);
						}).sort(function(discussionId1, discussionId2) {
							return clDiscussionSvc.discussionOffsets[discussionId1] - clDiscussionSvc.discussionOffsets[discussionId2];
						});
						updateEditorPostitPosition();
						scope.$evalAsync();
					}
				}, 1000);

				function updateEditorPostitPosition() {
					clDiscussionSvc.editorPostitOffsets = [];
					scope.$broadcast('clUpdateEditorPostitPosition');
				}

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
					clDiscussionSvc.currentDiscussionId = undefined;
					$timeout(function() {
						clLocalSettingSvc.values.sideBar = true;
						clLocalSettingSvc.values.sideBarTab = 'discussions';
						clDiscussionSvc.currentDiscussionId = clDiscussionSvc.newDiscussionId;
					});
				};

				scope.$watch('editorSvc.lastTextToPreviewDiffs', function(value) {
					value && scope.$broadcast('clTextToPreviewDiffsChanged');
				});

				scope.$watchGroup(['editorSvc.editorElt.clientWidth', 'editorSvc.editorElt.clientHeight'], clDiscussionSvc.updateEditorPostitPosition);
				scope.$watch('discussionSvc.showEditorDiscussionPostits()', function(showDiscuscussionPostits) {
					if (showDiscuscussionPostits) {
						scope.showDiscuscussionPostits = true;
					} else {
						$timeout(function() {
							if (!clDiscussionSvc.showEditorDiscussionPostits()) {
								scope.showDiscuscussionPostits = false;
							}
						}, 1000);
					}
					updateEditorPostitPosition();
				});

				scope.$on('$destroy', function() {
					isDestroyed = true;
				});
			}
		})
	.directive('clPreviewDiscussionDecorator',
		function($window, $timeout, clEditorSvc, clEditorLayoutSvc, clDiscussionSvc, clLocalSettingSvc, clDiffUtils) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/discussions/previewDiscussionDecorator.html',
				link: link
			};

			function link(scope, element) {
				var selection,
					contentDao = scope.currentFileDao.contentDao;

				var unwatch = scope.$watch('editorSvc.cledit', function(cledit) {
					if (!cledit) {
						return;
					}
					unwatch();

					var newDiscussionBtnElt = element[0].querySelector('.new-discussion-btn');
					var lastCoordinates = {};

					function checkSelection() {
						var selectionMgr = clEditorSvc.cledit && clEditorSvc.cledit.selectionMgr;
						if (selectionMgr && clEditorSvc.previewSelectionRange && clEditorSvc.previewSelectionEndOffset) {
							selection = clDiscussionSvc.getTrimmedSelection(selectionMgr);
							if (!selection) {
								return;
							}
							var offset = clEditorSvc.getPreviewOffset(selection.end);
							var previewText = clEditorSvc.previewElt.textContent;
							while (offset && previewText[offset - 1] && previewText[offset - 1] === '\n') {
								offset--;
							}
							if (!offset) {
								return;
							}
							var start = $window.cledit.Utils.findContainer(clEditorSvc.previewElt, offset - 1);
							var end = $window.cledit.Utils.findContainer(clEditorSvc.previewElt, offset);
							var range = $window.document.createRange();
							range.setStart(start.container, start.offsetInContainer);
							range.setEnd(end.container, end.offsetInContainer);
							var rect = range.getBoundingClientRect();
							var contentRect = clEditorSvc.previewElt.getBoundingClientRect();
							var coordinates = {
								top: Math.round(rect.top - contentRect.top + clEditorSvc.previewElt.scrollTop),
								height: Math.round(rect.height),
								left: Math.round(rect.right - contentRect.left + clEditorSvc.previewElt.scrollLeft)
							};
							if (coordinates.top !== lastCoordinates.top ||
								coordinates.height !== lastCoordinates.height ||
								coordinates.left !== lastCoordinates.left
							) {
								lastCoordinates = coordinates;
								newDiscussionBtnElt.clanim
									.top(coordinates.top + coordinates.height)
									.left(coordinates.left)
									.start();
							}
							return true;
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
							if (clDiscussionSvc.currentDiscussionId === discussionId) {
								clDiscussionSvc.currentDiscussionId = undefined;
							} else {
								clLocalSettingSvc.values.sideBar = true;
								clLocalSettingSvc.values.sideBarTab = 'discussions';
								clDiscussionSvc.currentDiscussionId = discussionId;
							}
						}
					});

					scope.$watch('editorSvc.previewSelectionRange', toggleButton);
					scope.$watch('editorSvc.lastTextToPreviewDiffs', function(value) {
						value && clDiscussionSvc.updatePreviewPostitPosition();
					});

				});

				var isDestroyed = false;
				clDiscussionSvc.updatePreviewPostitPosition = $window.cledit.Utils.debounce(function() {
					if (!isDestroyed) {
						clDiscussionSvc.discussionsByOffset = Object.keys(contentDao.discussions).cl_filter(function(discussionId) {
							return clDiscussionSvc.discussionOffsets.hasOwnProperty(discussionId);
						}).sort(function(discussionId1, discussionId2) {
							return clDiscussionSvc.discussionOffsets[discussionId1] - clDiscussionSvc.discussionOffsets[discussionId2];
						});
						updatePreviewPostitPosition();
						scope.$evalAsync();
					}
				}, 1000);

				function updatePreviewPostitPosition() {
					clDiscussionSvc.previewPostitOffsets = [];
					scope.$broadcast('clUpdatePreviewPostitPosition');
				}

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
					clDiscussionSvc.currentDiscussionId = undefined;
					$timeout(function() {
						clLocalSettingSvc.values.sideBar = true;
						clLocalSettingSvc.values.sideBarTab = 'discussions';
						clDiscussionSvc.currentDiscussionId = clDiscussionSvc.newDiscussionId;
					});
				};

				scope.$watchGroup(['editorSvc.previewElt.clientWidth', 'editorSvc.previewElt.clientHeight'], clDiscussionSvc.updatePreviewPostitPosition);
				scope.$watch('discussionSvc.showPreviewDiscussionPostits()', function(showDiscuscussionPostits) {
					if (showDiscuscussionPostits) {
						scope.showDiscuscussionPostits = true;
					} else {
						$timeout(function() {
							if (!clDiscussionSvc.showPreviewDiscussionPostits()) {
								scope.showDiscuscussionPostits = false;
							}
						}, 1000);
					}
					updatePreviewPostitPosition();
				});

				scope.$on('$destroy', function() {
					isDestroyed = true;
				});
			}
		})
	.directive('clDiscussionHighlighter',
		function($window, clEditorSvc, clEditorClassApplier, clPreviewClassApplier, clDiffUtils, clDiscussionSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				var offset;

				var editorClassApplier = clEditorClassApplier(function() {
					var result = ['discussion-editor-highlighting-' + scope.discussionId, 'discussion-editor-highlighting'];
					clDiscussionSvc.currentDiscussionId === scope.discussionId && result.push('selected');
					return result;
				}, function() {
					if (!clEditorSvc.cledit.options) {
						return; // cledit not inited
					}
					var text = clEditorSvc.cledit.getContent();
					offset = {
						start: clDiffUtils.patchToOffset(text, scope.discussion.patches[0]),
						end: clDiffUtils.patchToOffset(text, scope.discussion.patches[1])
					};
					if (offset.start !== -1 && offset.end !== -1) {
						clDiscussionSvc.discussionOffsets[scope.discussionId] = offset.start;
						return offset;
					} else {
						delete clDiscussionSvc.discussionOffsets[scope.discussionId];
					}
					clDiscussionSvc.updateEditorPostitPosition();
				}, {
					discussionId: scope.discussionId
				});

				var previewClassApplier = clPreviewClassApplier(function() {
					var result = ['discussion-preview-highlighting-' + scope.discussionId, 'discussion-preview-highlighting'];
					clDiscussionSvc.currentDiscussionId === scope.discussionId && result.push('selected');
					return result;
				}, function() {
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

				scope.$watch('discussionSvc.currentDiscussionId === discussionId', function(selected) {
					$window.document.querySelectorAll(
						'.discussion-editor-highlighting-' + scope.discussionId +
						', .discussion-preview-highlighting-' + scope.discussionId
					).cl_each(function(elt) {
						elt.classList.toggle('selected', selected);
					});
				});

				scope.$on('clTextToPreviewDiffsChanged', function() {
					previewClassApplier.restore();
				});

				scope.$on('$destroy', function() {
					delete clDiscussionSvc.discussionOffsets[scope.discussionId];
					editorClassApplier && editorClassApplier.stop();
					previewClassApplier && previewClassApplier.remove();
				});
			}
		})
	.directive('clEditorDiscussionPostit',
		function(clEditorSvc, clDiscussionSvc) {
			var postitSize = 80;
			var overlapOffset = 30;
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionPostit.html',
				link: link
			};

			function link(scope, element) {
				var elt = element[0].querySelector('.discussion-postit'),
					discussionHighlightingElts = clEditorSvc.editorElt.getElementsByClassName('discussion-editor-highlighting-' + scope.discussionId),
					translateX, translateY, isVisible, isSelected,
					rotation = -(1 + 3 * Math.random());

				function setPosition() {
					var firstElt = discussionHighlightingElts[0];
					isVisible = clDiscussionSvc.showEditorDiscussionPostits() && firstElt && firstElt.offsetTop;
					if (isVisible) {
						translateY = firstElt.offsetTop;
						translateX = 1;
						while (clDiscussionSvc.editorPostitOffsets[translateY]) {
							translateY++;
						}
						for (var i = -postitSize; i < postitSize; i++) {
							if (clDiscussionSvc.editorPostitOffsets[translateY + i] >= translateX) {
								translateX = clDiscussionSvc.editorPostitOffsets[translateY + i] + 4;
							}
						}
						for (i = -overlapOffset; i < overlapOffset; i++) {
							clDiscussionSvc.editorPostitOffsets[translateY + i] = translateX;
						}
					}
					animate();
				}

				function animate() {
					var x = 0,
						y = 0;
					if (isVisible) {
						x = isSelected ? 20 : translateX;
						y = translateY + 200;
					}
					elt.clanim
						.translateX(x)
						.translateY(y)
						.rotate(isSelected ? rotation + 1 : rotation)
						.duration(300)
						.easing('materialOut')
						.start(true)
						.style.zIndex = isSelected ? 1 : 0;
				}

				scope.select = function() {
					if (clDiscussionSvc.currentDiscussionId !== scope.discussionId) {
						clDiscussionSvc.currentDiscussionId = scope.discussionId;
					} else {
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				};

				scope.$watch('discussionSvc.lastComments[discussionId]', function(commentId) {
					scope.lastComment = scope.currentFileDao.contentDao.comments[commentId];
				});

				scope.$watch('discussionSvc.currentDiscussionId === discussionId', function(value) {
					isSelected = value;
					animate();
				});

				setPosition();
				scope.$on('clUpdateEditorPostitPosition', setPosition);
			}
		})
	.directive('clPreviewDiscussionPostit',
		function(clEditorSvc, clDiscussionSvc) {
			var postitSize = 80;
			var overlapOffset = 30;
			return {
				restrict: 'E',
				templateUrl: 'optional/discussions/discussionPostit.html',
				link: link
			};

			function link(scope, element) {
				var elt = element[0].querySelector('.discussion-postit'),
					discussionHighlightingElts = clEditorSvc.previewElt.getElementsByClassName('discussion-preview-highlighting-' + scope.discussionId),
					translateX, translateY, isVisible, isSelected,
					rotation = -(1 + 3 * Math.random());

				function setPosition() {
					var firstElt = discussionHighlightingElts[0];
					isVisible = clDiscussionSvc.showPreviewDiscussionPostits() && firstElt && firstElt.offsetTop;
					if (isVisible) {
						translateY = firstElt.offsetTop;
						translateX = 1;
						while (clDiscussionSvc.previewPostitOffsets[translateY]) {
							translateY++;
						}
						for (var i = -postitSize; i < postitSize; i++) {
							if (clDiscussionSvc.previewPostitOffsets[translateY + i] >= translateX) {
								translateX = clDiscussionSvc.previewPostitOffsets[translateY + i] + 4;
							}
						}
						for (i = -overlapOffset; i < overlapOffset; i++) {
							clDiscussionSvc.previewPostitOffsets[translateY + i] = translateX;
						}
					}
					animate();
				}

				function animate() {
					var x = 0,
						y = 0;
					if (isVisible) {
						x = isSelected ? 20 : translateX;
						y = translateY + 200;
					}
					elt.clanim
						.translateX(x)
						.translateY(y)
						.rotate(isSelected ? rotation + 1 : rotation)
						.duration(300)
						.easing('materialOut')
						.start(true)
						.style.zIndex = isSelected ? 1 : 0;
				}

				scope.select = function() {
					if (clDiscussionSvc.currentDiscussionId !== scope.discussionId) {
						clDiscussionSvc.currentDiscussionId = scope.discussionId;
					} else {
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				};

				scope.$watch('discussionSvc.lastComments[discussionId]', function(commentId) {
					scope.lastComment = scope.currentFileDao.contentDao.comments[commentId];
				});

				scope.$watch('discussionSvc.currentDiscussionId === discussionId', function(value) {
					isSelected = value;
					animate();
				});

				setPosition();
				scope.$on('clUpdatePreviewPostitPosition', setPosition);
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
				scope.$watch('discussionSvc.currentDiscussionId === discussionSvc.newDiscussionId', function(isNew) {
					scope.discussion = isNew && clDiscussionSvc.newDiscussion;
					scope.discussionId = isNew && clDiscussionSvc.newDiscussionId;
				});
				scope.$watch('localSettingSvc.values.sideBar && localSettingSvc.values.sideBarTab === "discussions"', function(isOpen) {
					if (!isOpen) {
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				});

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
					clDiscussionSvc.currentDiscussionId = undefined;
					$timeout(function() {
						clDiscussionSvc.currentDiscussionId = clDiscussionSvc.newDiscussionId;
					});
				};

				scope.$watch('currentFileDao.contentDao.comments', clDiscussionSvc.refreshLastComments);
			}
		})
	.directive('clDiscussionItem',
		function($window, clDiscussionSvc, clDialog, clToast, clEditorSvc, clEditorLayoutSvc) {
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
					if (clDiscussionSvc.currentDiscussionId !== scope.discussionId) {
						clDiscussionSvc.currentDiscussionId = scope.discussionId;
						setTimeout(function() {
							var elt = clEditorLayoutSvc.isEditorOpen ?
								$window.document.querySelector('.discussion-editor-highlighting-' + scope.discussionId) :
								$window.document.querySelector('.discussion-preview-highlighting-' + scope.discussionId);
							if (!elt) {
								return clToast('Discussion can\'t be located in the file.');
							}
							var offset = elt.offsetTop - clEditorSvc.scrollOffset;
							var scrollerElt = clEditorLayoutSvc.isEditorOpen ?
								clEditorSvc.editorElt.parentNode :
								clEditorSvc.previewElt.parentNode;
							scrollerElt.clanim.scrollTop(offset < 0 ? 0 : offset).duration(400).easing('materialOut').start();
						}, 10);
					} else if (clDiscussionSvc.currentDiscussionId !== clDiscussionSvc.newDiscussionId) {
						clDiscussionSvc.currentDiscussionId = undefined;
					}
				};
				scope.deleteDiscussion = function() {
					if (!scope.lastComment) {
						// That's the new discussion
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
				scope.$watch('discussionSvc.currentDiscussionId === discussionId', function(isCurrent) {
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
					content: lastContent
				});
				if (!clEditorSvc.cledit.selectionMgr.hasFocus) {
					cledit.selectionMgr.setSelectionStartEnd(lastSelectionStart, lastSelectionEnd);
				}

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
						clDiscussionSvc.currentDiscussionId = discussionId;
						clDiscussionSvc.updateEditorPostitPosition();
					}
					cledit.setContent('');
					var comment = {
						discussionId: discussionId,
						userId: clUserSvc.user.id,
						text: commentText,
						created: Date.now(),
					};
					contentDao.comments[clUid()] = comment;
					clDiscussionSvc.refreshLastComments();
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
						clDiscussionSvc.refreshLastComments();
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
		function($window, $rootScope, clUid, clEditorSvc, clEditorLayoutSvc, clLocalSettingSvc) {
			var clDiscussionSvc = {
				newDiscussion: {},
				newDiscussionId: clUid(),
				discussionOffsets: {},
			};

			function refreshLastComments() {
				if (!$rootScope.currentFileDao || $rootScope.currentFileDao.state !== 'loaded') {
					return;
				}
				var contentDao = $rootScope.currentFileDao.contentDao;
				clDiscussionSvc.lastComments = Object.keys(contentDao.comments).sort(function(commentId1, commentId2) {
					return contentDao.comments[commentId2].created - contentDao.comments[commentId1].created;
				}).cl_reduce(function(lastComments, commentId) {
					var comment = contentDao.comments[commentId];
					if (contentDao.discussions.hasOwnProperty(comment.discussionId)) {
						lastComments[comment.discussionId] = lastComments[comment.discussionId] || commentId;
					}
					return lastComments;
				}, {});
				clDiscussionSvc.lastCommentsArray = clDiscussionSvc.lastComments.cl_map(function(commentId) {
					return contentDao.comments[commentId];
				});
			}

			function getTrimmedSelection(selectionMgr) {
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

			function showEditorDiscussionPostits() {
				return clEditorLayoutSvc.isEditorOpen &&
					clLocalSettingSvc.values.sideBar &&
					clLocalSettingSvc.values.sideBarTab === 'discussions';
			}

			function showPreviewDiscussionPostits() {
				return !clEditorLayoutSvc.isEditorOpen &&
					clLocalSettingSvc.values.sideBar &&
					clLocalSettingSvc.values.sideBarTab === 'discussions';
			}

			clDiscussionSvc.refreshLastComments = refreshLastComments;
			clDiscussionSvc.getTrimmedSelection = getTrimmedSelection;
			clDiscussionSvc.showEditorDiscussionPostits = showEditorDiscussionPostits;
			clDiscussionSvc.showPreviewDiscussionPostits = showPreviewDiscussionPostits;
			return clDiscussionSvc;
		});
