angular.module('classeur.optional.findReplace', [])
	.directive('clFindReplace',
		function($window, clPanel, clEditorLayoutSvc, clEditorSvc, clEditorClassApplier) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/findReplace/findReplace.html',
				link: link
			};

			function link(scope, element) {
				var findReplacePanel = clPanel(element, '.findreplace.panel');
				var findInputElt = element[0].querySelector('.find.input');
				var replaceInputElt = element[0].querySelector('.replace.input');
				var speed;

				function isOpen() {
					return clEditorLayoutSvc.currentControl === 'findreplace' && clEditorLayoutSvc.isEditorOpen;
				}

				function move() {
					highlightOccurrences();
					if (isOpen()) {
						!findInputElt.readOnly && setTimeout(function() {
							findInputElt.focus();
						}, 10);
					} else {
						findInputElt.readOnly = true;
						findInputElt.blur();
						replaceInputElt.readOnly = true;
						replaceInputElt.blur();
					}
					findReplacePanel.move(speed).to(-clEditorLayoutSvc.backgroundX,
						isOpen() ? 0 : 40
					).then(function() {
						if (isOpen()) {
							findInputElt.readOnly = false;
							replaceInputElt.readOnly = false;
							findInputElt.focus();
							highlightOccurrences();
						}
					}).end();
					speed = 'slow';
				}

				var offsetList = [],
					classAppliers = {};

				function dynamicClassApplier(cssClass, offset) {
					var startMarker = new $window.cledit.Marker(offset.start);
					var endMarker = new $window.cledit.Marker(offset.end);
					clEditorSvc.cledit.addMarker(startMarker);
					clEditorSvc.cledit.addMarker(endMarker);
					var classApplier = clEditorClassApplier(['find-replace-' + startMarker.id, cssClass], function() {
						return {
							start: startMarker.offset,
							end: endMarker.offset
						};

					});
					classApplier.startMarker = startMarker;
					classApplier.endMarker = endMarker;
					classApplier.clean = function() {
						clEditorSvc.cledit.removeMarker(startMarker);
						clEditorSvc.cledit.removeMarker(endMarker);
						classApplier.stop();
					};
					return classApplier;
				}

				var highlightOccurrences = $window.cledit.Utils.debounce(function() {
					var caseSensitive = false;
					var useRegexp = false;
					var oldClassAppliers = {};
					Object.keys(classAppliers).forEach(function(key) {
						var classApplier = classAppliers[key];
						var newKey = classApplier.startMarker.offset + ':' + classApplier.endMarker.offset;
						oldClassAppliers[newKey] = classApplier;
					});
					offsetList = [];
					classAppliers = {};
					if (isOpen() && scope.findText) {
						try {
							var flags = caseSensitive ? 'gm' : 'gmi';
							var regex = useRegexp ? scope.findText : scope.findText.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
							regex = new RegExp(regex, flags);
							clEditorSvc.cledit.getContent().replace(regex, function(match, offset) {
								offsetList.push({
									start: offset,
									end: offset + match.length
								});
							});
							// CPU consuming, add a limit
							if (offsetList.length < 200) {
								offsetList.forEach(function(offset) {
									var key = offset.start + ':' + offset.end;
									classAppliers[key] = oldClassAppliers[key] || dynamicClassApplier('find-replace-highlighting', offset);
								});
							}
						} catch (e) {}
					}
					Object.keys(oldClassAppliers).forEach(function(key) {
						var classApplier = oldClassAppliers[key];
						if (!classAppliers.hasOwnProperty(key)) {
							classApplier.clean();
						}
					});
					scope.findCount = offsetList.length;
					if (selectionClassApplier &&
						!classAppliers.hasOwnProperty(selectionClassApplier.startMarker.offset + ':' + selectionClassApplier.endMarker.offset)
					) {
						selectionOffset = undefined;
						highlightSelection();
					}
				}, 25);

				var selectionOffset, selectionClassApplier;

				function find() {
					var selectionMgr = clEditorSvc.cledit.selectionMgr;
					var position = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
					selectionOffset = offsetList[0];
					offsetList.some(function(offset) {
						if (offset.start > position) {
							selectionOffset = offset;
							return true;
						}
					});
					if (selectionOffset) {
						selectionMgr.setSelectionStartEnd(selectionOffset.start, selectionOffset.end);
						selectionMgr.updateCursorCoordinates(true);
					}
					highlightSelection();
				}

				function highlightSelection() {
					if (isOpen() && selectionOffset) {
						if (!selectionClassApplier ||
							selectionClassApplier.startMarker.offset !== selectionOffset.start ||
							selectionClassApplier.endMarker.offset !== selectionOffset.end
						) {
							selectionClassApplier && selectionClassApplier.clean();
							selectionClassApplier = dynamicClassApplier('find-replace-selection', selectionOffset);
						}
					} else {
						selectionClassApplier && selectionClassApplier.clean();
						selectionClassApplier = undefined;
					}
				}

				$window.addEventListener('keydown', function(evt) {
					if (evt.which !== 70 || (!evt.metaKey && !evt.ctrlKey) || !clEditorLayoutSvc.isEditorOpen) {
						// Not Ctrl/Cmd+F
						return;
					}
					evt.preventDefault();
					clEditorLayoutSvc.currentControl = 'findreplace';
					move();
				});

				findInputElt.addEventListener('keydown', function(evt) {
					if (evt.which === 13) {
						// Enter key
						evt.preventDefault();
						find();
						findInputElt.focus();
					}
				});
				replaceInputElt.addEventListener('keydown', function(evt) {
					if (evt.which === 13) {
						// Enter key
						evt.preventDefault();
						find();
						replaceInputElt.focus();
					}
				});

				scope.$watch('editorLayoutSvc.currentControl === "findreplace"', move);
				scope.$watch('editorSvc.isEditorOpen', move);
				scope.$watch('findText', highlightOccurrences);
				clEditorSvc.cledit.on('contentChanged', highlightOccurrences);
			}
		});
