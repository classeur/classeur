angular.module('classeur.optional.zenMode', [])
	.directive('clZenModeSettings',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/zenMode/zenModeSettings.html'
			};
		})
	.directive('clZenMode',
		function($window, clEditorLayoutSvc, clLocalSettingSvc) {
			return {
				restrict: 'E',
				template: '<div class="zen panel level-1 hidden"><div class="panel mask background"></div><div class="panel level-2 background"></div></div>',
				link: link
			};

			function link(scope, element) {
				var level1Elt = element[0].querySelector('.level-1').clanim.width(4000).right(-1500).start(),
					level2Elt = element[0].querySelector('.level-2'),
					parentNode = element[0].parentNode,
					lastClientX, lastClientY, isHidden = true,
					isTyping;

				function isEnabled() {
					return isTyping &&
						clLocalSettingSvc.values.zenMode &&
						clEditorLayoutSvc.isEditorOpen &&
						!clLocalSettingSvc.values.sideBar &&
						!clEditorLayoutSvc.isSidePreviewOpen &&
						!clEditorLayoutSvc.isMenuOpen;
				}

				var showLevel1 = $window.cledit.Utils.debounce(function() {
					if (!isEnabled()) {
						return;
					}
					level1Elt.classList.remove('hidden');
					level1Elt.offsetWidth;
					level1Elt.clanim
						.opacity(1)
						.duration(1500)
						.easing('ease-out')
						.start();
					isHidden = false;
				}, 3000);

				var showLevel2 = $window.cledit.Utils.debounce(function() {
					isEnabled() && level2Elt.clanim
						.opacity(1)
						.duration(300)
						.easing('ease-out')
						.start(true);
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
							level2Elt.clanim
								.duration(100)
								.opacity(0.9)
								.easing('ease-out')
								.start(true);
						}
						showLevel1();
						showLevel2();
					}
					unhide && !isHidden && level1Elt.clanim
						.opacity(0)
						.duration(100)
						.easing('ease-out')
						.start(function() {
							isHidden = true;
							isTyping = false;
							level1Elt.classList.add('hidden');
						});
				}

				level1Elt.clanim.opacity(0).start();
				hidePanel();
				var containerElt = document.querySelector('.background.panel');
				containerElt.addEventListener('keydown', function(evt) {
					if (evt.altKey || evt.ctrlKey || evt.metaKey) {
						return;
					}
					isTyping = true;
					showLevel1();
					showLevel2();
				});
				containerElt.addEventListener('mousemove', hidePanel);
				containerElt.addEventListener('click', hidePanel);

				scope.$watch('editorLayoutSvc.isEditorOpen', hidePanel.cl_bind(null, null));
				scope.$on('$destroy', function() {
					containerElt.removeEventListener('mousemove', hidePanel);
					containerElt.removeEventListener('click', hidePanel);
				});
			}
		});
