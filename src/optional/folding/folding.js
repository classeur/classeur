angular.module('classeur.optional.folding', [])
	.directive('clFolding',
		function($timeout, clFoldingSvc, clEditorSvc) {
			return {
				restrict: 'A',
				link: link
			};

			function link(scope, element) {
				var mouseX, mouseY;
				var sectionGroupHover, timeoutId;

				function removeSectionGroupHover() {
					if (sectionGroupHover) {
						var elt = sectionGroupHover.sections[0].elt;
						elt.className = elt.className.replace(/ folding-hover/g, '');
						sectionGroupHover = undefined;
					}
				}

				function setSectionGroupHover(sectionGroup) {
					removeSectionGroupHover();
					sectionGroupHover = sectionGroup;
					sectionGroupHover.sections[0].elt.className += ' folding-hover';
					clearTimeout(timeoutId);
					timeoutId = setTimeout(removeSectionGroupHover, 3000);
				}

				element.on('mousemove', function(e) {
					var newMouseX = e.clientX;
					var newMouseY = e.clientY + element[0].scrollTop;
					if (mouseX === newMouseX && mouseY === newMouseY) {
						return;
					}
					mouseX = newMouseX;
					mouseY = newMouseY;
					var sectionGroup = clFoldingSvc.getSectionGroup(mouseY + 10);
					if (!sectionGroup) {
						return;
					}
					setSectionGroupHover(sectionGroup);
				});

				function buttonClickHandler(handler) {
					return function(e) {
						if (!sectionGroupHover || e.target !== sectionGroupHover.sections[0].elt) {
							return;
						}
						var offsetX = e.offsetX || e.clientX - e.target.getBoundingClientRect().left;
						if (offsetX < 0) {
							e.preventDefault();
							setSectionGroupHover(sectionGroupHover);
							handler && handler(sectionGroupHover);
						}
					};
				}

				element.on('mousedown', buttonClickHandler());
				element.on('click', buttonClickHandler(function(sectionGroup) {
					sectionGroup[sectionGroup.isFolded ? 'unfold' : 'fold']();
				}));
				element.on('dblclick', buttonClickHandler(function(sectionGroup) {
					var functionName = sectionGroup.isFolded ? 'unfold' : 'fold';
					var parent = sectionGroup.parent;
					// Fold/unfold all sections that have the same parent
					clFoldingSvc.sectionGroups.cl_each(function(sectionGroup) {
						sectionGroup.parent === parent && sectionGroup[functionName]();
					});
				}));

				element.on('keydown', function(e) {
					var selectionStart = clEditorSvc.cledit.selectionMgr.selectionStart;
					var selectionEnd = clEditorSvc.cledit.selectionMgr.selectionEnd;
					if (selectionStart !== selectionEnd) {
						return;
					}
					if (e.which === 8 && selectionStart > 0) {
						// Backspace
						var range = clEditorSvc.cledit.selectionMgr.createRange(selectionStart - 1, selectionEnd - 1);
						clFoldingSvc.unfoldRange(range);
					}
					if (e.which === 46) {
						// Del
						clEditorSvc.selectionRange && clFoldingSvc.unfoldRange(clEditorSvc.selectionRange);
					}
				});

				var debouncedBuildSectionGroups = window.cledit.Utils.debounce(function() {
					clEditorSvc.sectionList && clFoldingSvc.buildSectionGroups(clEditorSvc.sectionList);
				}, 10);

				var debouncedunfoldRange = window.cledit.Utils.debounce(function() {
					clEditorSvc.selectionRange && clFoldingSvc.unfoldRange(clEditorSvc.selectionRange);
				}, 10);

				scope.$watch('editorSvc.sectionList', debouncedBuildSectionGroups);
				scope.$watch('editorSvc.selectionRange', debouncedunfoldRange);
			}
		})
	.factory('clFoldingSvc',
		function(clEditorSvc) {

			function SectionGroup(firstElt, level) {
				this.firstElt = firstElt;
				this.level = level;
				this.sections = [];
				this.children = [];
			}

			function setHideClass(hide, elt) {
				var className = (elt.className || '').replace(/(?:^|\s)hide(?!\S)/g, '');
				if (hide) {
					className += ' hide';
				}
				elt.className = className;
				return elt;
			}

			var hideElt = setHideClass.cl_bind(null, true);
			var showElt = setHideClass.cl_bind(null, false);

			SectionGroup.prototype.fold = function(force) {
				if (!force && this.isFolded) {
					return;
				}
				this.hideSections();
				var elt = this.sections[0].elt.firstChild;
				while (elt && elt.textContent.slice(-1) != '\n') {
					showElt(elt);
					elt = elt.nextSibling;
				}
				elt && showElt(elt);
				// Set folded state
				this.sections[0].elt.className += ' folded';
				this.isFolded = true;
			};

			SectionGroup.prototype.hideSections = function() {

				// Add `hide` class in every section
				this.sections.cl_each(function(section) {
					section.elt.children.cl_each(hideElt);
				});

				// Also do that in every child group
				this.children.cl_each(function(childGroup) {
					// Unset folded state in case child was folded
					var elt = childGroup.sections[0].elt;
					elt.className = elt.className.replace(/ folded/g, '');
					childGroup.isFolded = false;
					childGroup.isParentFolded = true;
					childGroup.hideSections();
				});
			};

			SectionGroup.prototype.unfold = function() {
				var sectionGroup = this;
				while (sectionGroup.isParentFolded) {
					sectionGroup = sectionGroup.parent;
				}
				if (sectionGroup.isFolded) {
					sectionGroup.showSections();
					// Unset folded state
					var elt = sectionGroup.sections[0].elt;
					elt.className = elt.className.replace(/ folded/g, '');
					sectionGroup.isFolded = false;
					return true;
				}
			};

			SectionGroup.prototype.showSections = function() {

				// Remove `hide` class in every section
				this.sections.cl_each(function(section) {
					section.elt.children.cl_each(showElt);
				});

				// Also do that in every child group
				this.children.cl_each(function(childGroup) {
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
				oldSectionList && oldSectionList.cl_each(function(section) {
					if (section.elt.parentNode || !section.elt.sectionGroup) {
						return;
					}

					// Section group has been modified
					section.elt.sectionGroup.unfold();
				});
				oldSectionList = sectionList;

				// List groups
				var sectionGroup;
				var newSectionGroups = [];
				sectionList.cl_each(function(section) {
					var firstChild = section.elt.firstChild;
					if (!firstChild) {
						return;
					}

					// Create new group when encounter section starting with heading
					var match = firstChild.className.match(/^token h([1-6])(?:\s|$)/);
					if (match) {
						sectionGroup = new SectionGroup(firstChild, parseInt(match[1]));
						if (section.elt.sectionGroup) {
							// Keep folding state from old group
							sectionGroup.isFolded = section.elt.sectionGroup.isFolded;
							sectionGroup.isParentFolded = section.elt.sectionGroup.isParentFolded;
						} else {
							newSectionGroups.push(sectionGroup);
						}
						folding.sectionGroups.push(sectionGroup);
					}

					if (sectionGroup) {
						// Add section to existing group
						sectionGroup.sections.push(section);
						section.elt.sectionGroup = sectionGroup;
					}
				});

				// Make hierarchy
				var stack = [];
				folding.sectionGroups.cl_each(function(sectionGroup) {
					while (stack.length && stack[stack.length - 1].level >= sectionGroup.level) {
						stack.pop();
					}
					if (stack.length) {
						sectionGroup.parent = stack[stack.length - 1];
						sectionGroup.parent.children.push(sectionGroup);
					}
					stack.push(sectionGroup);
				});

				// Unfold parent/children of new section groups
				newSectionGroups.cl_each(function(sectionGroup) {
					sectionGroup.parent && sectionGroup.parent.unfold();
					sectionGroup.children.cl_each(function(childGroup) {
						childGroup.unfold();
					});
				});
			}

			function getSectionGroup(offsetTop) {
				var result;
				folding.sectionGroups.cl_some(function(sectionGroup) {
					var sectionOffsetTop = sectionGroup.firstElt.offsetTop;
					if (sectionOffsetTop > offsetTop) {
						return true;
					}
					if (sectionOffsetTop) {
						result = sectionGroup;
					}
				});
				return result;
			}

			function unfold(sectionGroup) {
				while (sectionGroup.isParentFolded) {
					sectionGroup = sectionGroup.parent;
				}
				if (sectionGroup.isFolded) {
					sectionGroup.unfold();
					return true;
				}
			}

			function unfoldRange(range) {
				var isStarted, isFinished;
				var startContainer = range.startContainer;
				var endContainer = range.endContainer;
				clEditorSvc.sectionList && clEditorSvc.sectionList.cl_some(function(section) {
					if (section.elt.contains(startContainer)) {
						isFinished = isStarted;
						isStarted = true;
					}
					if (section.elt.contains(endContainer)) {
						isFinished = isStarted;
						isStarted = true;
					}
					if (isStarted) {
						section.elt.sectionGroup && unfold(section.elt.sectionGroup);
					}
					if (isFinished) {
						return true;
					}
				});
			}

			folding.buildSectionGroups = buildSectionGroups;
			folding.getSectionGroup = getSectionGroup;
			folding.unfoldRange = unfoldRange;

			return folding;
		});
