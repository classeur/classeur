angular.module('classeur.optional.offlineAlert', [])
	.directive('clOfflineIndicator',
		function($window, clSocketSvc, clUserActivity) {
			return {
				restrict: 'E',
				scope: true,
				templateUrl: 'optional/offlineAlert/offlineIndicator.html',
				link: link
			}

			function link(scope, element) {
				var isHover, panelElt = element[0].querySelector('.panel'),
					duration

				function toggle() {
					panelElt.clanim
						.duration(duration)
						.translateX(isHover ? 0 : -2)
						.start(true)
					duration = 200
				}

				panelElt.addEventListener('mouseenter', function() {
					isHover = true
					toggle()
				})
				panelElt.addEventListener('mouseleave', function() {
					isHover = false
					toggle()
				})
				toggle()

				function setFlag() {
					var show = !clSocketSvc.hasToken || (!clSocketSvc.isReady && clUserActivity.isActive)
					if (scope.currentFileDao && scope.currentFileDao.isLocalFile) {
						show = false
					}
					if (show !== scope.show) {
						scope.show = show
						return true
					}
				}
				var debouncedSetFlag = $window.cledit.Utils.debounce(function() {
					setFlag() && scope.$apply()
				}, 5000)

				scope.$watch('!socketSvc.isReady && userActivity.isActive', debouncedSetFlag)
			}
		})
	.directive('clOfflineAlert',
		function() {
			return {
				restrict: 'E',
				template: '<cl-offline-alert-panel ng-if="editorLayoutSvc.currentControl === \'offlineAlert\'"></cl-offline-alert-panel><cl-signin-alert-panel ng-if="editorLayoutSvc.currentControl === \'signinAlert\'"></cl-signin-alert-panel>',
			}
		})
	.directive('clOfflineAlertPanel',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/offlineAlert/offlineAlertPanel.html',
			}
		})
	.directive('clSigninAlertPanel',
		function() {
			return {
				restrict: 'E',
				templateUrl: 'optional/offlineAlert/signinAlertPanel.html',
			}
		})
