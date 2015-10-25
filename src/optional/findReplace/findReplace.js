angular.module('classeur.optional.findReplace', [])
	.directive('clFindReplace',
		function($window, clEditorLayoutSvc, clEditorSvc, clEditorClassApplier) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/findReplace/findReplace.html',
				link: link
			};

			function link(scope, element) {
				var findReplaceElt = element[0].querySelector('.findreplace.panel');
				var findInputElt = findReplaceElt.querySelector('.find.input');
				var replaceInputElt = findReplaceElt.querySelector('.replace.input');
				var duration;

				function isOpen() {
					return clEditorLayoutSvc.currentControl === 'findreplace' && clEditorLayoutSvc.isEditorOpen;
				}

				function move() {
					highlightOccurrences();
					if (isOpen()) {
						!findInputElt.readOnly && setTimeout(function() {
							findInputElt.select();
						}, 10);
					} else {
						findInputElt.blur();
						replaceInputElt.blur();
						findInputElt.readOnly = true;
						replaceInputElt.readOnly = true;
					}
					findReplaceElt.clanim
						.translateX(-clEditorLayoutSvc.backgroundX)
						.translateY(isOpen() ? 0 : 40)
						.duration(duration)
						.start(function() {
							if (isOpen()) {
								findInputElt.readOnly = false;
								replaceInputElt.readOnly = false;
								findInputElt.select();
								highlightOccurrences();
							}
						});
					duration = 200;
				}

				function DynamicClassApplier(cssClass, offset, silent) {
					this.startMarker = new $window.cledit.Marker(offset.start);
					this.endMarker = new $window.cledit.Marker(offset.end);
					clEditorSvc.cledit.addMarker(this.startMarker);
					clEditorSvc.cledit.addMarker(this.endMarker);
					var classApplier = !silent && clEditorClassApplier(['find-replace-' + this.startMarker.id, cssClass], (function() {
						return {
							start: this.startMarker.offset,
							end: this.endMarker.offset
						};
					}).cl_bind(this));
					this.clean = function() {
						clEditorSvc.cledit.removeMarker(this.startMarker);
						clEditorSvc.cledit.removeMarker(this.endMarker);
						classApplier && classApplier.stop();
					};
				}

				var classAppliers = Object.create(null),
					selectedClassApplier, searchRegex;

				var highlightOccurrences = $window.cledit.Utils.debounce(function() {
					var caseSensitive = false;
					var useRegexp = false;
					var oldClassAppliers = Object.create(null);
					Object.keys(classAppliers).cl_each(function(key) {
						var classApplier = classAppliers[key];
						var newKey = classApplier.startMarker.offset + ':' + classApplier.endMarker.offset;
						oldClassAppliers[newKey] = classApplier;
					});
					var offsetList = [];
					classAppliers = {};
					if (isOpen() && scope.findText) {
						try {
							var flags = caseSensitive ? 'gm' : 'gmi';
							searchRegex = useRegexp ? scope.findText : scope.findText.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
							searchRegex = new RegExp(searchRegex, flags);
							clEditorSvc.cledit.getContent().replace(searchRegex, function(match, offset) {
								offsetList.push({
									start: offset,
									end: offset + match.length
								});
							});
							for (var i = 0; i < offsetList.length; i++) {
								var offset = offsetList[i];
								var key = offset.start + ':' + offset.end;
								classAppliers[key] = oldClassAppliers[key] || new DynamicClassApplier('find-replace-highlighting', offset, i > 200);
							}
						} catch (e) {}
					}
					Object.keys(oldClassAppliers).cl_each(function(key) {
						var classApplier = oldClassAppliers[key];
						if (!classAppliers[key]) {
							classApplier.clean();
							if (classApplier === selectedClassApplier) {
								selectedClassApplier.child.clean();
								selectedClassApplier = undefined;
							}
						}
					});
					scope.findCount = offsetList.length;
				}, 25);

				scope.find = function() {
					var selectionMgr = clEditorSvc.cledit.selectionMgr;
					var position = Math.min(selectionMgr.selectionStart, selectionMgr.selectionEnd);
					if (selectedClassApplier) {
						selectedClassApplier.child.clean();
						selectedClassApplier.child = undefined;
					}
					var keys = Object.keys(classAppliers);
					selectedClassApplier = classAppliers[keys[0]];
					keys.cl_some(function(key) {
						if (classAppliers[key].startMarker.offset > position) {
							selectedClassApplier = classAppliers[key];
							return true;
						}
					});
					if (selectedClassApplier) {
						selectionMgr.setSelectionStartEnd(
							selectedClassApplier.startMarker.offset,
							selectedClassApplier.endMarker.offset
						);
						selectionMgr.updateCursorCoordinates(true);
					}
					if (selectedClassApplier) {
						selectedClassApplier.child = new DynamicClassApplier('find-replace-selection', {
							start: selectedClassApplier.startMarker.offset,
							end: selectedClassApplier.endMarker.offset,
						});
					}
					findInputElt.focus();
				};

				scope.replace = function() {
					function findNext() {
						scope.find();
						replaceInputElt.focus();
					}
					if (!selectedClassApplier) {
						return findNext();
					}
					clEditorSvc.cledit.replace(
						selectedClassApplier.startMarker.offset,
						selectedClassApplier.endMarker.offset,
						scope.replaceText || '');
					setTimeout(findNext, 1);
				};

				scope.replaceAll = function() {
					searchRegex && clEditorSvc.cledit.replaceAll(searchRegex, scope.replaceText || '');
				};

				$window.addEventListener('keydown', function(evt) {
					if (evt.which !== 70 || (!evt.metaKey && !evt.ctrlKey) || !clEditorLayoutSvc.isEditorOpen) {
						// Not Ctrl/Cmd+F
						return;
					}
					evt.preventDefault();
					clEditorLayoutSvc.currentControl = 'findreplace';
					var selection = clEditorSvc.cledit.selectionMgr.getSelectedText();
					if (selection) {
						scope.findText = selection;
						scope.$evalAsync();
					}
					move();
				});

				findInputElt.addEventListener('keydown', function(evt) {
					if (evt.which === 13) {
						// Enter key
						evt.preventDefault();
						scope.find();
					}
				});
				replaceInputElt.addEventListener('keydown', function(evt) {
					if (evt.which === 13) {
						// Enter key
						evt.preventDefault();
						scope.find();
						replaceInputElt.focus();
					}
				});

				scope.$watch('editorLayoutSvc.currentControl === "findreplace"', move);
				scope.$watch('editorSvc.isEditorOpen', move);
				scope.$watch('findText', highlightOccurrences);
				clEditorSvc.cledit.on('contentChanged', highlightOccurrences);
			}
		});
