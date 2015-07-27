angular.module('classeur.optional.zenMode', [])
	.directive('clZenModeSettings',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/zenMode/zenModeSettings.html'
			};
		})
	.directive('clZenMode',
		function($window, clPanel, clEditorLayoutSvc, clLocalSettingSvc) {
			return {
				restrict: 'E',
				template: '<div class="zen panel level-1 hidden"><div class="panel mask background"></div><div class="panel level-2 background"></div></div>',
				link: link
			};

			function link(scope, element) {
				var level1Panel = clPanel(element, '.level-1').width(4000).right(-1500),
					level2Panel = clPanel(element, '.level-2'),
					parentNode = element[0].parentNode,
					lastClientX, lastClientY, isHidden = true,
					isTyping;

				function isEnabled() {
					return isTyping &&
						clLocalSettingSvc.values.zenMode &&
						clEditorLayoutSvc.isEditorOpen &&
						!clEditorLayoutSvc.isSideBarOpen &&
						!clEditorLayoutSvc.isSidePreviewOpen &&
						!clEditorLayoutSvc.isMenuOpen;
				}

				var showLevel1 = $window.cledit.Utils.debounce(function() {
					if (!isEnabled()) {
						return;
					}
					level1Panel.$jqElt.removeClass('hidden');
					level1Panel.$elt.offsetWidth;
					level1Panel.move().set('opacity', 1).duration(1200).ease('in').end();
					isHidden = false;
				}, 3000);

				var showLevel2 = $window.cledit.Utils.debounce(function() {
					if (isEnabled()) {
						level2Panel.move('sslow').set('opacity', 1).ease('in').end();
					}
				}, 400);

				function hidePanel(evt) {
					var unhide = true;
					if (isEnabled()) {
						if (evt) {
							if (evt.type === 'mousemove' && lastClientX === evt.clientX && lastClientY === evt.clientY) {
								return;
							}
							lastClientX = evt.clientX;
							lastClientY = evt.clientY;
							var minLeft = parentNode.getBoundingClientRect().left + parentNode.offsetWidth;
							if (evt.clientX < minLeft) {
								unhide = false;
							}
							level2Panel.move('fast').set('opacity', 0.9).ease('out').end();
						}
						showLevel1();
						showLevel2();
					}
					unhide && !isHidden && level1Panel.move('fast').set('opacity', 0).ease('out').end(function() {
						isHidden = true;
						isTyping = false;
						level1Panel.$jqElt.addClass('hidden');
					});
				}

				level1Panel.move().set('opacity', 0).end();
				hidePanel();
				var containerElt = document.querySelector('.background.panel');
				containerElt.addEventListener('keydown', function() {
					isTyping = true;
					showLevel1();
					showLevel2();
				});
				containerElt.addEventListener('mousemove', hidePanel);
				containerElt.addEventListener('click', hidePanel);

				scope.$watch('editorLayoutSvc.isEditorOpen', hidePanel.bind(null, null));
				scope.$on('$destroy', function() {
					containerElt.removeEventListener('mousemove', hidePanel);
					containerElt.removeEventListener('click', hidePanel);
				});
			}
		});
