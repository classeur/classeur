angular.module('classeur.optional.userActivity', [])
	.directive('clUserActivity',
		function($window, $timeout, $rootScope, clUserInfoSvc, clEditorSvc, clEditorClassApplier, clContentSyncSvc) {
			var colors = [
				'ff5757',
				'e35d9c',
				'7d5af4',
				'5772e3',
				'57abab',
				'57c78f',
				'57ce68',
				'56ae72',
				'73ae74',
				'8fbe6d',
				'ffc758',
				'ffab58',
				'ff8f57',
				'ff7457',
			];
			var styleElt = $window.document.createElement('style');
			styleElt.type = 'text/css';
			$window.document.getElementsByTagName('head')[0].appendChild(styleElt);
			var userClasses = Object.create(null);

			function refreshClasses() {
				var styleContent = '';
				Object.keys(userClasses).cl_each(function(userId) {
					var userClass = userClasses[userId];
					styleContent += '.user-activity-' + userId + ' {';
					styleContent += '-webkit-box-shadow: inset -2px 0 #' + userClass.color + ';';
					styleContent += 'box-shadow: inset -2px 0 #' + userClass.color + '}';
					var userInfo = clUserInfoSvc.users[userId];
					var escapedUsername = ((userInfo && userInfo.name) || userId).replace(/[\s\S]/g, function(character) {
						var escape = character.charCodeAt().toString(16);
						return '\\' + ('000000' + escape).slice(-6);
					});
					styleContent += '.user-activity-' + userId + '::after {';
					styleContent += 'background-color: #' + userClass.color + ';';
					styleContent += 'content: \'' + escapedUsername + '\';';
				});
				styleElt.innerHTML = styleContent;
			}

			function createUserClass(userId) {
				if (!userClasses[userId]) {
					userClasses[userId] = {
						color: colors[Math.random() * colors.length | 0]
					};
					refreshClasses();
				}
			}

			$rootScope.$watch('userInfoSvc.lastUserInfo', refreshClasses);

			var Marker = $window.cledit.Marker,
				id = 0;

			return {
				restrict: 'E',
				link: link
			};

			function link(scope) {
				createUserClass(scope.userId);
				var classApplier, marker, timeoutId;

				function unsetHighlighting() {
					marker && clEditorSvc.cledit.removeMarker(marker);
					classApplier && classApplier.stop();
					$timeout.cancel(timeoutId);
				}

				function highlightOffset(offset) {
					unsetHighlighting();
					if (!offset) {
						return;
					}
					marker = new Marker(offset.end);
					clEditorSvc.cledit.addMarker(marker);
					classApplier = clEditorClassApplier(['user-activity' + id++, 'user-activity-' + scope.userId, 'user-activity'], function() {
						var offset = marker.offset;
						var content = clEditorSvc.cledit.getContent();
						while (content[offset - 1] === '\n') {
							offset--;
						}
						return offset > 0 && {
							start: offset - 1,
							end: offset
						};
					});
					timeoutId = $timeout(function() {
						if (clContentSyncSvc.watchCtx) {
							delete clContentSyncSvc.watchCtx.userActivities[scope.userId];
						}
					}, 30000);
				}
				scope.$watch('userActivity.offset', highlightOffset);

				scope.$on('$destroy', function() {
					unsetHighlighting();
				});
			}
		});
