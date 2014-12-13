angular.module('classeur.extensions.folding', [])
	.directive('clFoldingGutter', function(folding) {
		return {
			restrict: 'E',
			templateUrl: 'app/extensions/folding/foldingGutter.html',
			scope: true,
			link: function(scope) {
				scope.folding = folding;
				scope.hide = function() {
					folding.hideButton.sectionGroup.hide();
					folding.hideButton.isShown = false;
				};
			}
		};
	})
	.directive('clFolding', function(folding,$timeout) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var editorElt = element[0];

				var hideTimeout;
				editorElt.addEventListener('mousemove', function(e) {
					var sectionGroup = folding.getSectionGroup(e.clientY - editorElt.getBoundingClientRect().top);
					if(!sectionGroup) {
						return;
					}
					var titleEltRect = sectionGroup.titleElt.getBoundingClientRect();
					var offsetY = titleEltRect.top + titleEltRect.height / 2 - editorElt.getBoundingClientRect().top;
					folding.hideButton.sectionGroup = sectionGroup;
					folding.hideButton.setTop(offsetY);
					folding.hideButton.isShown = true;
					scope.$apply();
					$timeout.cancel(hideTimeout);
					hideTimeout = $timeout(function() {
						folding.hideButton.isShown = false;
					}, 3000);
				});

				scope.$watch('cledit.sectionList', window.ced.Utils.debounce(folding.buildSectionGroups, 10));
			}
		};
	})
	.factory('folding', function($timeout, cledit) {
		var foldingButtonHeight = 26;

		function FoldingButton() {
			this.setTop(0);
			this.isShown = false;
		}

		FoldingButton.prototype.setTop = function(top) {
			this.top = (top - foldingButtonHeight / 2) + 'px';
		};

		function SectionGroup(titleElt, level) {
			this.titleElt = titleElt;
			this.offsetTop = titleElt.offsetTop;
			this.level = level;
			this.sections = [];
			this.children = [];
		}

		function hideNextElt(elt) {
			while(elt) {
				elt.className = (elt.className || '') + ' hide';
				elt = elt.nextSibling;
			}
		}

		SectionGroup.prototype.hide = function() {
			hideNextElt(this.titleElt.nextSibling);
			this.hideChildren();
		};

		SectionGroup.prototype.hideChildren = function() {
			this.children.forEach(function(childGroup) {
				hideNextElt(childGroup.titleElt);
				childGroup.hideChildren();
			});
		};

		var sectionGroups = [];
		function buildSectionGroups() {
			sectionGroups = [];
			if(!cledit.sectionList) {
				return;
			}
			var sectionGroup;

			// List groups
			cledit.sectionList.forEach(function(section) {
				var firstChild = section.elt.firstChild;
				if(!firstChild) {
					return;
				}
				var match = firstChild.className.match(/^token h([1-6])(?:\s|$)/);
				if(match) {
					sectionGroup = new SectionGroup(firstChild, parseInt(match[1]));
					sectionGroups.push(sectionGroup);
				}
				if(sectionGroup) {
					sectionGroup.sections.push(section);
					section.elt.sectionGroup = sectionGroup;
				}
			});

			// Make hierarchy
			var stack = [];
			sectionGroups.forEach(function(sectionGroup) {
				while(stack.length && stack[stack.length - 1].level >= sectionGroup.level) {
					stack.pop();
				}
				if(stack.length) {
					sectionGroup.parent = stack[stack.length - 1];
					sectionGroup.parent.children.push(sectionGroup);
				}
				stack.push(sectionGroup);
			});
		}

		function getSectionGroup(offsetTop) {
			var result;
			sectionGroups.some(function(sectionGroup) {
				if(sectionGroup.offsetTop > offsetTop) {
					return true;
				}
				result = sectionGroup;
			});
			return result;
		}

		return {
			hideButton: new FoldingButton(),
			buildSectionGroups: buildSectionGroups,
			getSectionGroup: getSectionGroup
		};
	});
