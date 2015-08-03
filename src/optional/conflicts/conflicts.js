angular.module('classeur.optional.conflicts', [])
	.directive('clConflictDecorator',
		function(clDialog, clEditorSvc, clConflictSvc, clToast) {
			return {
				restrict: 'E',
				templateUrl: 'optional/conflicts/conflictDecorator.html',
				link: link
			};

			function link(scope, element) {
				var parentElt = element[0].parentNode;
				var contentDao = scope.currentFileDao.contentDao;

				function getConflictElt(elt) {
					while (elt && elt !== parentElt) {
						if (elt.conflictId) {
							return elt;
						}
						elt = elt.parentNode;
					}
				}
				parentElt.addEventListener('mouseover', function(evt) {
					var conflictElt = getConflictElt(evt.target);
					conflictElt && Array.prototype.slice.call(parentElt.getElementsByClassName(
						'conflict-highlighting-part-' + conflictElt.conflictPart + '-' + conflictElt.conflictId
					)).forEach(function(elt) {
						elt.classList.add('hover');
					});
				});
				parentElt.addEventListener('mouseout', function(evt) {
					var conflictElt = getConflictElt(evt.target);
					conflictElt && Array.prototype.slice.call(parentElt.getElementsByClassName(
						'conflict-highlighting-part-' + conflictElt.conflictPart + '-' + conflictElt.conflictId
					)).forEach(function(elt) {
						elt.classList.remove('hover');
					});
				});
				parentElt.addEventListener('click', function(evt) {
					var conflictElt = getConflictElt(evt.target);
					if (conflictElt && contentDao.conflicts.hasOwnProperty(conflictElt.conflictId)) {
						var text = clEditorSvc.cledit.getContent();
						var conflict = contentDao.conflicts[conflictElt.conflictId];
						var offsets = clConflictSvc.patchToOffset(text, conflict.patches);
						if (offsets) {
							clDialog.show({
								templateUrl: 'optional/conflicts/fixConflictDialog.html',
								controller: ['$scope', function(scope) {
									scope.part1 = text.slice(offsets.offset1, offsets.offset2);
									scope.part2 = text.slice(offsets.offset2, offsets.offset3);
									scope.selectedPart = conflictElt.conflictPart;
								}],
								onComplete: function(scope) {
									scope.cancel = function() {
										clDialog.hide();
									};
									scope.fix = function() {
										clDialog.hide();
										var text = clEditorSvc.cledit.getContent();
										var offsets = clConflictSvc.patchToOffset(text, conflict.patches);
										if (!offsets) {
											return clToast('Conflict can\'t be located in the file.');
										}
										var newText = text.slice(0, offsets.offset1);
										newText += scope.selectedPart === 1 ?
											text.slice(offsets.offset1, offsets.offset2) :
											text.slice(offsets.offset2, offsets.offset3);
										newText += text.slice(offsets.offset3);
										clEditorSvc.cledit.setContent(newText);
										clConflictSvc.deleteConflict(contentDao, conflictElt.conflictId);
									};
								}
							});
						}
					}
				});
			}
		})
	.directive('clConflictHighlighter',
		function(clEditorSvc, clEditorClassApplier, clConflictSvc) {
			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				var contentDao = scope.currentFileDao.contentDao;

				var classApplier1 = clEditorClassApplier([
					'conflict-highlighting-part-1-' + scope.conflictId,
					'conflict-highlighting-' + scope.conflictId,
					'conflict-highlighting-part-1',
					'conflict-highlighting'
				], function() {
					if(!clEditorSvc.cledit.options) {
						return; // cledit not inited
					}
					var text = clEditorSvc.cledit.getContent();
					var offsets = clConflictSvc.patchToOffset(text, scope.conflict.patches);
					if (offsets) {
						return {
							start: offsets.offset1,
							end: offsets.offset2
						};
					}
					clConflictSvc.deleteConflict(contentDao, scope.conflictId);
				}, {
					conflictId: scope.conflictId,
					conflictPart: 1
				});

				var classApplier2 = clEditorClassApplier([
					'conflict-highlighting-part-2-' + scope.conflictId,
					'conflict-highlighting-' + scope.conflictId,
					'conflict-highlighting-part-2',
					'conflict-highlighting',
				], function() {
					if(!clEditorSvc.cledit.options) {
						return; // cledit not inited
					}
					var text = clEditorSvc.cledit.getContent();
					var offsets = clConflictSvc.patchToOffset(text, scope.conflict.patches);
					if (offsets) {
						return {
							start: offsets.offset2,
							end: offsets.offset3
						};
					}
					clConflictSvc.deleteConflict(contentDao, scope.conflictId);
				}, {
					conflictId: scope.conflictId,
					conflictPart: 2
				});

				scope.$on('$destroy', function() {
					classApplier1 && classApplier1.stop();
					classApplier2 && classApplier2.stop();
				});
			}
		})
	.directive('clConflictAlert',
		function($window, $timeout, clEditorLayoutSvc, clToast, clEditorSvc, clScrollAnimation) {
			return {
				restrict: 'E',
				scope: true,
				template: '<cl-conflict-alert-panel ng-if="editorLayoutSvc.currentControl === \'conflictAlert\'"></cl-conflict-alert-panel>',
				link: link
			};

			function link(scope) {
				var contentDao = scope.currentFileDao.contentDao;
				$timeout(function() {
					if(Object.keys(contentDao.conflicts).length) {
						clEditorLayoutSvc.currentControl = 'conflictAlert';
					}
				}, 500);

				scope.$watch('currentFileDao.contentDao.conflicts', function() {
					if(clEditorLayoutSvc.currentControl === 'conflictAlert' && !Object.keys(contentDao.conflicts).length) {
						clEditorLayoutSvc.currentControl = undefined;
					}
				});

				scope.dismiss = function() {
					clEditorLayoutSvc.currentControl = undefined;
				};

				var conflictId;
				scope.next = function() {
					var conflictKeys = Object.keys(contentDao.conflicts);
					conflictId = conflictKeys[(conflictKeys.indexOf(conflictId) + 1) % conflictKeys.length];
					var elt = $window.document.querySelector('.conflict-highlighting-' + conflictId);
					if (!elt) {
						return clToast('Conflict can\'t be located in the file.');
					}
					var offset = elt.offsetTop - clEditorSvc.scrollOffset - 180;
					var scrollerElt = clEditorSvc.editorElt.parentNode;
					clScrollAnimation(scrollerElt, offset < 0 ? 0 : offset);
				};
			}
		})
	.directive('clConflictAlertPanel',
		function(clDraggablePanel) {
			return {
				restrict: 'E',
				templateUrl: 'optional/conflicts/conflictAlertPanel.html',
				link: function(scope, element) {
					clDraggablePanel(element, '.conflict-alert.panel', 0, 0, -1);
				}
			};
		})
	.factory('clConflictSvc',
		function($window) {
			var diffMatchPatch = new $window.diff_match_patch();
			diffMatchPatch.Match_Distance = 999999999;
			var marker = '\uF111\uF222\uF333';

			function patchToOffset(text, patches) {
				patches = patches.map(function(patch) {
					var markersLength = 0;
					var diffs = patch.diffs.map(function(diff) {
						if (!diff) {
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
				return splitedText.length === 4 && {
					offset1: splitedText[0].length,
					offset2: splitedText[0].length + splitedText[1].length,
					offset3: splitedText[0].length + splitedText[1].length + splitedText[2].length
				};
			}

			function deleteConflict(contentDao, conflictIdToRemove) {
				// Create a new object to trigger watchers
				contentDao.conflicts = Object.keys(contentDao.conflicts).reduce(function(conflicts, conflictId) {
					if(conflictId !== conflictIdToRemove) {
						conflicts[conflictId] = contentDao.conflicts[conflictId];
					}
					return conflicts;
				}, {});
			}

			return {
				patchToOffset: patchToOffset,
				deleteConflict: deleteConflict,
			};
		});
