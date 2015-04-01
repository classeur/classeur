angular.module('classeur.opt.zenMode', [])
	.directive('clZenModeSettings', function() {
		return {
			restrict: 'E',
			templateUrl: 'opt/zenMode/zenModeSettings.html'
		};
	})
	.directive('clZenMode', function($window, clPanel, clEditorLayoutSvc, clSettingSvc) {
		clSettingSvc.setDefaultValue('zenMode', true);

		return {
			restrict: 'E',
			template: '<div class="zen panel level-1 hidden"><div class="zen panel level-2 background"></div></div>',
			link: function(scope, element) {
				var level1Panel = clPanel(element, '.level-1').width(4000).right(-1500);
				var level2Panel = clPanel(element, '.level-2');
				level1Panel.move().set('opacity', 0).end();
				var parentNode = element[0].parentNode;
				var lastClientX, lastClientY, isHidden = true;

				function isEnabled() {
					return clSettingSvc.values.zenMode && clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen && !clEditorLayoutSvc.isMenuOpen;
				}

				var showLevel1 = $window.cledit.Utils.debounce(function() {
					if (!isEnabled()) {
						return;
					}
					level1Panel.$elt.removeClass('hidden');
					level1Panel.$$elt.offsetWidth;
					level1Panel.move().set('opacity', 1).duration(1200).ease('in').end();
					isHidden = false;
				}, 4000);

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
							level2Panel.move('fast').set('opacity', 0.8).ease('out').end();
						}
						showLevel1();
						showLevel2();
					}
					unhide && !isHidden && level1Panel.move('fast').set('opacity', 0).ease('out').end(function() {
						isHidden = true;
						level1Panel.$elt.addClass('hidden');
					});
				}

				hidePanel();
				document.addEventListener('mousemove', hidePanel);
				document.addEventListener('click', hidePanel);

				scope.$watch('editorLayoutSvc.isEditorOpen', hidePanel.bind(null, null));
				scope.$on('$destroy', function() {
					document.removeEventListener('mousemove', hidePanel);
					document.removeEventListener('click', hidePanel);
				});
			}
		};
	});
