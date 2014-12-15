angular.module('classeur.extensions.folding', [])
	.directive('clFoldingGutter', function(folding) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/folding/foldingGutter.html',
			scope: true,
			link: function(scope, element) {
				var gutterElt = element[0].querySelector('.folding-gutter');
				scope.folding = folding;
				function updateFoldButtons() {
					folding.sectionGroups.forEach(function(sectionGroup) {
						var titleEltRect = sectionGroup.firstElt.getBoundingClientRect();
						var offsetY = titleEltRect.top + titleEltRect.height / 2 - gutterElt.getBoundingClientRect().top;
						sectionGroup.foldButton.setTop(offsetY);
					});
				}

				scope.fold = function(sectionGroup) {
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

				scope.$watch('folding.sectionGroups', updateFoldButtons);
				scope.$watch('cledit.editorSize()', updateFoldButtons);
			}
		};
	})
	.directive('clFolding', function($timeout, folding) {
		return {
			restrict: 'A',
			link: function(scope, element) {

				var editorElt = element[0].querySelector('.editor');
				var hideTimeout, hideTimeoutCb;
				var clientX, clientY;
				element.on('mousemove', function(e) {
					if(clientX === e.clientX && clientY === e.clientY) {
						return;
					}
					clientX = e.clientX;
					clientY = e.clientY;
					var sectionGroup = folding.getSectionGroup(clientY + element[0].scrollTop);
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

				scope.$watch('cledit.sectionList', folding.buildSectionGroups);

				function unfoldContainer(node) {
					if(!(editorElt.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY)) {
						return;
					}
					while(node.parentNode !== editorElt) {
						node = node.parentNode;
					}
					var sectionGroup = node.sectionGroup;
					if(sectionGroup) {
						while(sectionGroup.isParentFolded) {
							sectionGroup = sectionGroup.parent;
						}
						if(sectionGroup.isFolded) {
							sectionGroup.unfold();
							return true;
						}
					}
				}

				scope.$watch('cledit.editor.selectionMgr', function(selectionMgr) {
					selectionMgr.onSelectionChanged(function(start, end, selectionRange) {
						if(selectionRange && (unfoldContainer(selectionRange.startContainer) | unfoldContainer(selectionRange.endContainer))) {
							scope.$apply();
						}
					});
				});
			}
		};
	})
	.factory('folding', function() {
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
			var className = elt.className.replace(/ hide$/, '');
			if(hide) {
				className += ' hide';
			}
			elt.className = className;
		}

		var hideElt = setHideClass.bind(undefined, true);
		var showElt = setHideClass.bind(undefined, false);

		SectionGroup.prototype.fold = function(force) {
			if(!force && this.isFolded) {
				return;
			}
			var lastSection = this.hideSections();
			// Show first child
			showElt(this.sections[0].elt.firstChild);
			// Show last LF
			var lfElt = lastSection.elt.lastChild;
			// Find last LF deeper in the section
			while(lfElt.textContent != '\n') {
				lfElt = lfElt.lastChild;
			}
			// Move last LF in section element
			lastSection.elt.appendChild(lfElt);
			showElt(lfElt);
			this.isFolded = true;
		};

		SectionGroup.prototype.hideSections = function() {
			var lastSection;

			// Add `hide` class in every section
			this.sections.forEach(function(section) {
				lastSection = section;
				Array.prototype.forEach.call(section.elt.children, hideElt);
			});

			// Also do that in every child group
			this.children.forEach(function(childGroup) {
				childGroup.isFolded = false;
				childGroup.isParentFolded = true;
				lastSection = childGroup.hideSections();
			});
			return lastSection;
		};

		SectionGroup.prototype.unfold = function() {
			this.isFolded && this.showSections();
			this.isFolded = false;
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
			if(!sectionList) {
				return;
			}

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

		folding.buildSectionGroups = buildSectionGroups;
		folding.getSectionGroup = getSectionGroup;

		return folding;
	});
