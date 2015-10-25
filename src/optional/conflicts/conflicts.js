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
					)).cl_each(function(elt) {
						elt.classList.add('hover');
					});
				});
				parentElt.addEventListener('mouseout', function(evt) {
					var conflictElt = getConflictElt(evt.target);
					conflictElt && Array.prototype.slice.call(parentElt.getElementsByClassName(
						'conflict-highlighting-part-' + conflictElt.conflictPart + '-' + conflictElt.conflictId
					)).cl_each(function(elt) {
						elt.classList.remove('hover');
					});
				});
				parentElt.addEventListener('click', function(evt) {
					var conflictElt = getConflictElt(evt.target);
					if (conflictElt && contentDao.conflicts.hasOwnProperty(conflictElt.conflictId)) {
						var text = clEditorSvc.cledit.getContent();
						var conflict = contentDao.conflicts[conflictElt.conflictId];
						var offsets = clConflictSvc.getConflictOffsets(text, conflict);
						if (offsets) {
							clDialog.show({
								templateUrl: 'optional/conflicts/fixConflictDialog.html',
								controller: ['$scope', function(scope) {
									scope.part1 = text.slice(offsets[0], offsets[1]);
									scope.part2 = text.slice(offsets[1], offsets[2]);
									scope.selectedPart = conflictElt.conflictPart;
								}],
								onComplete: function(scope) {
									scope.cancel = function() {
										clDialog.hide();
									};
									scope.fix = function() {
										clDialog.hide();
										var text = clEditorSvc.cledit.getContent();
										var offsets = clConflictSvc.getConflictOffsets(text, conflict);
										if (!offsets) {
											return clToast('Conflict can\'t be located in the file.');
										}
										var newText = text.slice(0, offsets[0]);
										newText += scope.selectedPart === 1 ?
											text.slice(offsets[0], offsets[1]) :
											text.slice(offsets[1], offsets[2]);
										newText += text.slice(offsets[2]);
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
					if (!clEditorSvc.cledit.options) {
						return; // cledit not inited
					}
					var text = clEditorSvc.cledit.getContent();
					var offsets = clConflictSvc.getConflictOffsets(text, scope.conflict);
					if (offsets) {
						return {
							start: offsets[0],
							end: offsets[1]
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
					if (!clEditorSvc.cledit.options) {
						return; // cledit not inited
					}
					var text = clEditorSvc.cledit.getContent();
					var offsets = clConflictSvc.getConflictOffsets(text, scope.conflict);
					if (offsets) {
						return {
							start: offsets[1],
							end: offsets[2]
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
		function($window, $timeout, clEditorLayoutSvc, clToast, clEditorSvc) {
			return {
				restrict: 'E',
				scope: true,
				template: '<cl-conflict-alert-panel ng-if="editorLayoutSvc.currentControl === \'conflictAlert\'"></cl-conflict-alert-panel>',
				link: link
			};

			function link(scope) {
				var contentDao = scope.currentFileDao.contentDao;
				var timeoutId = $timeout(function() {
					if (Object.keys(contentDao.conflicts).length) {
						clEditorLayoutSvc.currentControl = 'conflictAlert';
					}
				}, 2000);

				scope.$watch('currentFileDao.contentDao.conflicts', function() {
					if (clEditorLayoutSvc.currentControl === 'conflictAlert' && !Object.keys(contentDao.conflicts).length) {
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
					scrollerElt.clanim.scrollTop(offset < 0 ? 0 : offset).duration(400).easing('materialOut').start();
				};

				scope.$on('$destroy', function() {
					$timeout.cancel(timeoutId);
				});
			}
		})
	.directive('clConflictAlertPanel',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/conflicts/conflictAlertPanel.html'
			};
		})
	.factory('clConflictSvc',
		function($window, clDiffUtils) {
			function getConflictOffsets(text, conflict) {
				var offsets = [
					clDiffUtils.patchToOffset(text, conflict.patches[0]),
					clDiffUtils.patchToOffset(text, conflict.patches[1]),
					clDiffUtils.patchToOffset(text, conflict.patches[2]),
				];
				return offsets[0] !== -1 && offsets[1] !== -1 && offsets[2] !== -1 && offsets;
			}

			function deleteConflict(contentDao, conflictIdToRemove) {
				// Create a new object to trigger watchers
				contentDao.conflicts = contentDao.conflicts.cl_reduce(function(conflicts, conflict, conflictId) {
					if (conflictId !== conflictIdToRemove) {
						conflicts[conflictId] = conflict;
					}
					return conflicts;
				}, {});
			}

			return {
				getConflictOffsets: getConflictOffsets,
				deleteConflict: deleteConflict,
			};
		});
