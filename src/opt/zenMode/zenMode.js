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
			template: '<div class="zen panel background hidden"></div>',
			link: function(scope, element) {
				var zenPanel = clPanel(element, '.zen.panel').width(4000).right(-1500);
				zenPanel.move().set('opacity', 0).end();
				var parentNode = element[0].parentNode;

				var currentLevel = 0,
					lastClientX, lastClientY;

				function isEnabled() {
					return clSettingSvc.values.zenMode && clEditorLayoutSvc.isEditorOpen && !clEditorLayoutSvc.isSidePreviewOpen && !clEditorLayoutSvc.isMenuOpen;
				}

				var showPanel = $window.cledit.Utils.debounce(function() {
					if (!isEnabled()) {
						return;
					}
					zenPanel.$elt.removeClass('hidden');
					zenPanel.$$elt.offsetWidth;
					zenPanel.move().set('opacity', 1).duration(1200).ease('in').end();
					currentLevel = 2;
				}, 4000);

				function hidePanel(evt) {
					var level = 0;
					if(isEnabled()) {
						level = currentLevel;
						if (evt) {
							if (evt.type === 'mousemove' && lastClientX === evt.clientX && lastClientY === evt.clientY) {
								return;
							}
							lastClientX = evt.clientX;
							lastClientY = evt.clientY;
							level = 1;
							var minLeft = parentNode.getBoundingClientRect().left + parentNode.offsetWidth;
							if (evt.clientX > minLeft) {
								level = 0;
							}
						}
						showPanel();
					}
					if (level !== currentLevel) {
						if (level === 0) {
							zenPanel.move('fast').set('opacity', 0).ease('out').end(function() {
								!currentLevel && zenPanel.$elt.addClass('hidden');
							});
						} else if (level < currentLevel) {
							zenPanel.move('fast').set('opacity', 0.8).ease('out').end();
						}
						currentLevel = level;
					}
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
