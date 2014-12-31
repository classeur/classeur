angular.module('classeur.extensions.folding', [])
	.directive('clFoldingGutter', function(layout, folding) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/folding/foldingGutter.html',
			scope: true,
			link: function(scope) {
				scope.folding = folding;

				scope.fold = function(sectionGroup) {
					layout.currentControl = undefined;
					sectionGroup[sectionGroup.isFolded ? 'unfold' : 'fold']();
				};

				scope.foldAll = function(sectionGroup) {
					var functionName = sectionGroup.isFolded ? 'unfold' : 'fold';
					var parent = sectionGroup.parent;
					// Fold/unfold all sections that have the same parent
					folding.sectionGroups.forEach(function(sectionGroup) {
						sectionGroup.parent === parent && sectionGroup[functionName]();
					});
				};

			}
		};
	})
	.directive('clFolding', function($timeout, folding, editor) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var hideTimeout, hideTimeoutCb;
				var mouseX, mouseY;
				element.on('mousemove', function(e) {
					var newMouseX = e.clientX;
					var newMouseY = e.clientY + element[0].scrollTop;
					if(mouseX === newMouseX && mouseY === newMouseY) {
						return;
					}
					mouseX = newMouseX;
					mouseY = newMouseY;
					var sectionGroup = folding.getSectionGroup(mouseY);
					if(!sectionGroup) {
						return;
					}
					if(!sectionGroup.foldButton.forceShow) {
						hideTimeoutCb && hideTimeoutCb();
						hideTimeoutCb = function() {
							sectionGroup.foldButton.forceShow = false;
						};
						sectionGroup.foldButton.forceShow = true;
						scope.$apply();
					}
					$timeout.cancel(hideTimeout);
					hideTimeout = $timeout(hideTimeoutCb, 3000);
				});

				var sectionList, selectionRange;
				var debouncedUpdateFolding = window.cledit.Utils.debounce(function() {
					editor.sectionList !== sectionList && folding.buildSectionGroups(editor.sectionList);
					editor.selectionRange !== selectionRange && folding.unfoldSelection(editor.selectionRange);
					sectionList = editor.sectionList;
					selectionRange = editor.selectionRange;
					folding.refreshCoordinates();
					scope.$apply();
				}, 5);

				scope.$watch('editor.sectionList', debouncedUpdateFolding);
				scope.$watch('editor.selectionRange', debouncedUpdateFolding);
				scope.$watch('editor.editorSize()', debouncedUpdateFolding);
			}
		};
	})
	.factory('folding', function(editor) {
		var foldingButtonHeight = 24;

		function FoldButton() {
			this.setTop(-foldingButtonHeight);
		}

		FoldButton.prototype.setTop = function(top) {
			this.top = (top - foldingButtonHeight / 2) + 'px';
		};

		function SectionGroup(firstElt, level) {
			this.foldButton = new FoldButton();
			this.firstElt = firstElt;
			this.level = level;
			this.sections = [];
			this.children = [];
		}

		function setHideClass(hide, elt) {
			var className = (elt.className || '').replace(/(?:^|\s)hide(?!\S)/, '');
			if(hide) {
				className += ' hide';
			}
			elt.className = className;
			return elt;
		}

		var hideElt = setHideClass.bind(undefined, true);
		var showElt = setHideClass.bind(undefined, false);

		SectionGroup.prototype.fold = function(force) {
			if(!force && this.isFolded) {
				return;
			}
			this.hideSections();
			var elt = this.sections[0].elt.firstChild;
			while(elt && elt.textContent.slice(-1) != '\n') {
				showElt(elt);
				elt = elt.nextSibling;
			}
			elt && showElt(elt);
			this.isFolded = true;
		};

		SectionGroup.prototype.hideSections = function() {

			// Add `hide` class in every section
			this.sections.forEach(function(section) {
				Array.prototype.forEach.call(section.elt.children, hideElt);
			});

			// Also do that in every child group
			this.children.forEach(function(childGroup) {
				childGroup.isFolded = false;
				childGroup.isParentFolded = true;
				childGroup.hideSections();
			});
		};

		SectionGroup.prototype.unfold = function() {
			var sectionGroup = this;
			while(sectionGroup.isParentFolded) {
				sectionGroup = sectionGroup.parent;
			}
			if(sectionGroup.isFolded) {
				sectionGroup.showSections();
				sectionGroup.isFolded = false;
				return true;
			}
		};

		SectionGroup.prototype.showSections = function() {

			// Remove `hide` class in every section
			this.sections.forEach(function(section) {
				Array.prototype.forEach.call(section.elt.children, showElt);
			});

			// Also do that in every child group
			this.children.forEach(function(childGroup) {
				childGroup.isParentFolded = false;
				childGroup.showSections();
			});
		};

		var folding = {
			sectionGroups: []
		};

		var oldSectionList;

		function buildSectionGroups(sectionList) {
			folding.sectionGroups = [];

			// Unfold modified section groups
			oldSectionList && oldSectionList.forEach(function(section) {
				if(section.elt.parentNode) {
					return;
				}

				// Section group has been modified
				var sectionGroup = section.elt.sectionGroup;
				while(sectionGroup && !sectionGroup.isFolded) {
					sectionGroup = sectionGroup.parent;
				}

				if(sectionGroup) {
					// Unfold folded section group
					sectionGroup.isFolded = false;
				}
			});
			oldSectionList = sectionList;

			// List groups
			var sectionGroup;
			sectionList.forEach(function(section) {
				var firstChild = section.elt.firstChild;
				if(!firstChild) {
					return;
				}

				// Create new group when encounter section starting with heading
				var match = firstChild.className.match(/^token h([1-6])(?:\s|$)/);
				if(match) {
					sectionGroup = new SectionGroup(firstChild, parseInt(match[1]));
					if(section.elt.sectionGroup) {
						// Keep folding state from old group
						sectionGroup.isFolded = section.elt.sectionGroup.isFolded;
					}
					folding.sectionGroups.push(sectionGroup);
				}

				if(sectionGroup) {
					// Add section to existing group
					sectionGroup.sections.push(section);
					section.elt.sectionGroup = sectionGroup;
				}
			});

			// Make hierarchy
			var stack = [];
			folding.sectionGroups.forEach(function(sectionGroup) {
				sectionGroup.showSections();
				while(stack.length && stack[stack.length - 1].level >= sectionGroup.level) {
					stack.pop();
				}
				if(stack.length) {
					sectionGroup.parent = stack[stack.length - 1];
					sectionGroup.parent.children.push(sectionGroup);
				}
				stack.push(sectionGroup);
			});

			// Restore folded groups
			folding.sectionGroups.forEach(function(sectionGroup) {
				sectionGroup.isFolded && sectionGroup.fold(true);
			});
		}

		function refreshCoordinates() {
			var editorOffset = editor.editorElt.getBoundingClientRect().top + editor.editorElt.scrollTop;
			folding.sectionGroups.forEach(function(sectionGroup) {
				var titleEltRect = sectionGroup.firstElt.getBoundingClientRect();
				var offsetY = titleEltRect.top + titleEltRect.height / 2 - editorOffset;
				sectionGroup.foldButton.setTop(offsetY);
			});
		}

		function getSectionGroup(offsetTop) {
			var result;
			folding.sectionGroups.some(function(sectionGroup) {
				if(sectionGroup.firstElt.offsetTop > offsetTop) {
					return true;
				}
				result = sectionGroup;
			});
			return result;
		}

		function unfold(sectionGroup) {
			while(sectionGroup.isParentFolded) {
				sectionGroup = sectionGroup.parent;
			}
			if(sectionGroup.isFolded) {
				sectionGroup.unfold();
				return true;
			}
		}

		function unfoldSelection(selectionRange) {
			var editorLastChild = editor.editorElt.lastChild;
			var isStarted, isFinished, isUnfolded = false;
			var startContainer = selectionRange.startContainer;
			if(editorLastChild.contains(startContainer)) {
				// If trailing LF node is selected unfold last section
				startContainer = editorLastChild.previousSibling;
			}
			var endContainer = selectionRange.endContainer;
			if(editorLastChild.contains(endContainer)) {
				// If trailing LF node is selected unfold last section
				endContainer = editorLastChild.previousSibling;
			}
			editor.sectionList && editor.sectionList.some(function(section) {
				if(section.elt.contains(startContainer)) {
					if(isStarted) {
						isFinished = true;
					}
					isStarted = true;
				}
				if(section.elt.contains(endContainer)) {
					if(isStarted) {
						isFinished = true;
					}
					isStarted = true;
				}
				if(isStarted) {
					isUnfolded |= unfold(section.elt.sectionGroup);
				}
				if(isFinished) {
					return true;
				}
			});

			return isUnfolded;
		}

		folding.buildSectionGroups = buildSectionGroups;
		folding.refreshCoordinates = refreshCoordinates;
		folding.getSectionGroup = getSectionGroup;
		folding.unfoldSelection = unfoldSelection;

		return folding;
	});
